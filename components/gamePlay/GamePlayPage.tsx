'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/lib/hooks/useToast"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Territory, Unit, Player, initialUnits, InitialPlayers } from '@/lib/types/game'
import GameStatus from '@/components/gamePlay/GameStatus'
import ExecutionLog from '@/components/gamePlay/ExecutionLog'
import ChatSystem from '@/components/gamePlay/ChatSystem'
import GameMap from '@/components/gamePlay/GameMap'
import { get2DGrid, checkValidMove } from '@/lib/hooks/ReadContract'
import { useAccount } from 'wagmi'
import { Move } from '@/lib/types/game'
import { useMakeMove } from '@/lib/hooks/useMakeMove'


export default function DiplomacyGame() {
    const [territories, setTerritories] = useState<any[]>([])
    const [selectedTerritory, setSelectedTerritory] = useState<Territory | null>(null)
    const [actionType, setActionType] = useState<string>('move')
    const [moveStrength, setMoveStrength] = useState<number>(0)
    const [turnComplete, setTurnComplete] = useState<boolean>(false)
    const [players, setPlayers] = useState<Player[]>(InitialPlayers)
    const [currentPlayer, setCurrentPlayer] = useState<Player | null>(InitialPlayers[0] || null)
    const [executionRecord, setExecutionRecord] = useState<string[]>([])
    const { toast } = useToast()
    const { address } = useAccount()
    const { makeMove } = useMakeMove()

    useEffect(() => {
        const getGrids = async () => {
            try {
                const gridData = await get2DGrid();
                if (!gridData) return;
                // Type assertion since we know the shape of the data
                const newGridData = (gridData as any[][]).map((row: any[], rowIndex: number) =>
                    row.map((territory: any, colIndex: number) => ({
                        ...territory,
                        x: colIndex,
                        y: rowIndex
                    }))
                );
                setTerritories(newGridData as Territory[][]);
            } catch (error) {
                console.error('Error fetching grid:', error);
                toast({
                    title: "Error",
                    description: "Failed to fetch game state",
                    variant: "destructive",
                });
            }
        };

        getGrids();
    }, []);

    const handleTerritoryClick = (territory: Territory) => {
        // Check if territory belongs to current user
        if (territory.player !== address) {
            toast({
                title: "Invalid Selection",
                description: "You can only select territories that belong to you",
                variant: "destructive",
            });
            return;
        }

        setSelectedTerritory(territory);
        setActionType('move');
        setMoveStrength(0);
    }


    const getAdjacentTerritories = (territory: Territory): Territory[] => {
        if (!territory) return [];
        const adjacentTerritories: Territory[] = [];
        for (let i = 0; i < territories.length; i++) {
            for (let j = 0; j < territories[i].length; j++) {
                const dx = Math.abs(territory.x - territories[i][j].x)
                const dy = Math.abs(territory.y - territories[i][j].y)
                if (dx + dy === 1) {
                    adjacentTerritories.push(territories[i][j]);
                }
            }
        }

        return adjacentTerritories;
    };

    const handleAction = async (targetTerritory: Territory) => {
        console.log("TARGET TERRITORY", targetTerritory);
        if (!selectedTerritory || !address || turnComplete) {
            toast({
                title: "Invalid Action",
                description: "Cannot perform this action at this time.",
                variant: "destructive",
            });
            return;
        }

        try {
            const move: Move = {
                player: address,
                fromX: selectedTerritory.x,
                fromY: selectedTerritory.y,
                toX: targetTerritory.x,
                toY: targetTerritory.y,
                units: moveStrength
            };

            console.log("MOVE", move);
            // Validate move
            const isValidMove = await checkValidMove(move);
            console.log("IS VALID MOVE", isValidMove);
            if (isValidMove === false) {
                toast({
                    title: "Invalid Move",
                    description: "This move is not allowed by the game rules.",
                    variant: "destructive",
                });
                return;
            }

            // Make the move
            makeMove(move);

            toast({
                title: "Move Submitted",
                description: "Your move has been submitted to the blockchain",
            });

            setSelectedTerritory(null);
            setMoveStrength(0);
            setTurnComplete(true);

        } catch (error) {
            console.error('Error making move:', error);
            toast({
                title: "Error",
                description: "Failed to submit move to the blockchain",
                variant: "destructive",
            });
        }
    };

    const handleSendMessage = (recipientId: string, content: string) => {
        // In a real application, you would send this message to a server
        console.log(`Message sent to ${recipientId}: ${content}`)
        toast({
            title: "Message Sent",
            description: `Your message has been sent to ${players.find(p => p.id === recipientId)?.name}.`,
        })
    }



    return (
        <div className="flex flex-col h-screen">
            <div className="flex flex-1">
                <div className="flex-1 p-4">
                    <Tabs defaultValue="map" className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="map">Game Map</TabsTrigger>
                            <TabsTrigger value="chat">Diplomacy Chat</TabsTrigger>
                        </TabsList>
                        <TabsContent value="map">
                            <GameMap
                                territories={territories}
                                onTerritoryClick={handleTerritoryClick}
                            />
                        </TabsContent>
                        <TabsContent value="chat">
                            <ChatSystem
                                players={players}
                                currentPlayerId={currentPlayer?.id ?? ''}
                                onSendMessage={handleSendMessage}
                            />
                        </TabsContent>
                    </Tabs>

                </div>
                <div className="w-1/3 p-4 space-y-4">
                    <GameStatus currentPlayer={currentPlayer} players={players} />

                    <Card>
                        <CardHeader>
                            <CardTitle>Territory Information</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {selectedTerritory ? (
                                <div>
                                    <h3 className="text-lg font-bold mb-2">{selectedTerritory.name}</h3>
                                    <p className="mb-2">Type: {selectedTerritory.isCastle ? 'castle' : 'land'}</p>
                                    {!turnComplete && (
                                        <div className="space-y-4">
                                            <div>
                                                <Label htmlFor="moveStrength">Units to Move:</Label>
                                                <div className="flex gap-2 mt-1">
                                                    <Input
                                                        id="moveStrength"
                                                        type="number"
                                                        min="1"
                                                        max={selectedTerritory.units}
                                                        value={moveStrength}
                                                        onChange={(e) => setMoveStrength(parseInt(e.target.value))}
                                                        className="w-full"
                                                    />
                                                    <Button onClick={() => setMoveStrength(selectedTerritory.units)}>Max</Button>
                                                </div>
                                            </div>

                                            <div>
                                                <Label>Select Destination:</Label>
                                                <div className="grid gap-2 mt-1">
                                                    {getAdjacentTerritories(selectedTerritory).map(territory => (
                                                        <Button
                                                            key={territory.id}
                                                            className="w-full"
                                                            onClick={() => handleAction(territory)}
                                                            disabled={!moveStrength || moveStrength <= 0}
                                                        >
                                                            Move {moveStrength} units to {territory.x}, {territory.y}
                                                        </Button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <p>Select a territory to view information and perform actions.</p>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>

            <ExecutionLog executionRecord={executionRecord} />
        </div>
    )
}