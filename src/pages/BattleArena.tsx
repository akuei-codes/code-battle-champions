
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Code, 
  PlayCircle, 
  XCircle, 
  Loader2, 
  Copy, 
  CheckCircle,
  ChevronsUpDown,
  UserRound,
  Cpu,
  Clock,
  HelpCircle,
  ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Editor } from '@monaco-editor/react';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Problem, getProblemById } from '@/lib/problems';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Import types from supabase.ts
import type { Profile, Battle, Solution } from '@/lib/supabase';

// Define interfaces
type StatusIconType = React.ComponentType<React.SVGProps<SVGSVGElement>>;

interface Participant {
  id: string;
  name: string | null;
  avatar_url: string | null;
  rating: number;
}

const BattleArena = () => {
  const { battleId } = useParams<{ battleId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('javascript');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isBattleReady, setIsBattleReady] = useState(false);
  const [isBattleActive, setIsBattleActive] = useState(false);
  const [isBattleOver, setIsBattleOver] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [winner, setWinner] = useState<Participant | null>(null);
  const [loser, setLoser] = useState<Participant | null>(null);
  const [isEditorReady, setIsEditorReady] = useState(false);
  const [isCodeCopied, setIsCodeCopied] = useState(false);
  const [solutionFeedback, setSolutionFeedback] = useState('');
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  const editorRef = useRef<any>(null);
  
  const queryClient = useQueryClient();

  // Fetch battle details
  const { data: battle, isLoading: isBattleLoading } = useQuery({
    queryKey: ['battle', battleId],
    queryFn: async () => {
      if (!battleId) throw new Error("Battle ID is required");
      
      const { data, error } = await supabase
        .from('battles')
        .select('*')
        .eq('id', battleId)
        .single();

      if (error) {
        console.error("Supabase error:", error);
        throw error;
      }
      
      return data as Battle;
    },
    refetchInterval: isBattleActive ? 5000 : false, // Refetch every 5 seconds if battle is active
  });

  // Fetch problem details
  const { data: problem, isLoading: isProblemLoading } = useQuery({
    queryKey: ['problem', battle?.problem_id],
    queryFn: async () => {
      if (!battle?.problem_id) throw new Error("Problem ID is required");
      return getProblemById(battle.problem_id);
    },
    enabled: !!battle?.problem_id,
  });

  // Fetch creator profile
  const { data: creator, isLoading: isCreatorLoading } = useQuery({
    queryKey: ['creator', battle?.creator_id],
    queryFn: async () => {
      if (!battle?.creator_id) throw new Error("Creator ID is required");
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', battle.creator_id)
        .single();

      if (error) {
        console.error("Supabase error:", error);
        throw error;
      }
      
      return data as Profile;
    },
    enabled: !!battle?.creator_id,
  });

  // Fetch defender profile
  const { data: defender, isLoading: isDefenderLoading } = useQuery({
    queryKey: ['defender', battle?.defender_id],
    queryFn: async () => {
      if (!battle?.defender_id) throw new Error("Defender ID is required");
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', battle.defender_id)
        .single();

      if (error) {
        console.error("Supabase error:", error);
        throw error;
      }
      
      return data as Profile;
    },
    enabled: !!battle?.defender_id,
  });

  // Fetch solution details
  const { data: solution, isLoading: isSolutionLoading } = useQuery({
    queryKey: ['solution', battleId, user?.id],
    queryFn: async () => {
      if (!battleId || !user?.id) throw new Error("Battle ID and User ID are required");
      
      const { data, error } = await supabase
        .from('solutions')
        .select('*')
        .eq('battle_id', battleId)
        .eq('user_id', user.id)
        .single();

      if (error) {
        // If no solution is found, it's not an error, just return null
        if (error.code === 'PGRST116') {
          return null;
        }
        console.error("Supabase error:", error);
        throw error;
      }
      
      return data as Solution;
    },
    enabled: !!battleId && !!user?.id,
    retry: false, // Do not retry refetching if no solution is found
  });

  // Mutation to submit solution
  const submitSolutionMutation = useMutation({
    mutationFn: async () => {
      if (!battleId || !user?.id) throw new Error("Battle ID and User ID are required");
      
      const { data, error } = await supabase
        .from('solutions')
        .insert([
          {
            battle_id: battleId,
            user_id: user.id,
            code: code,
            submitted_at: new Date().toISOString(),
          }
        ])
        .select()
        .single();
      
      if (error) {
        console.error("Supabase error:", error);
        throw error;
      }
      
      return data;
    },
    onSuccess: () => {
      toast.success("Solution submitted successfully!");
      queryClient.invalidateQueries({ queryKey: ['solution', battleId, user?.id] });
    },
    onError: (error: any) => {
      console.error("Error submitting solution:", error);
      toast.error("Failed to submit solution. Please try again.");
    },
    onSettled: () => {
      setIsSubmitting(false);
    }
  });

  // Mutation to join the battle
  const joinBattleMutation = useMutation({
    mutationFn: async () => {
      if (!battleId || !user?.id) throw new Error("Battle ID and User ID are required");
      
      const { data, error } = await supabase
        .from('battles')
        .update({ 
          defender_id: user.id, 
          status: 'in_progress', 
          start_time: new Date().toISOString() 
        })
        .eq('id', battleId)
        .eq('status', 'waiting')
        .select()
        .single();
      
      if (error) {
        console.error("Supabase error:", error);
        throw error;
      }
      
      return data;
    },
    onSuccess: () => {
      toast.success("Joined battle successfully!");
      queryClient.invalidateQueries({ queryKey: ['battle', battleId] });
    },
    onError: (error: any) => {
      console.error("Error joining battle:", error);
      toast.error("Failed to join battle. Please try again.");
    }
  });

  // Mutation to end the battle
  const endBattleMutation = useMutation({
    mutationFn: async (winnerId: string) => {
      if (!battleId) throw new Error("Battle ID is required");
      
      const { data, error } = await supabase
        .from('battles')
        .update({ 
          status: 'completed', 
          end_time: new Date().toISOString(), 
          winner_id: winnerId 
        })
        .eq('id', battleId)
        .select()
        .single();
      
      if (error) {
        console.error("Supabase error:", error);
        throw error;
      }
      
      return data;
    },
    onSuccess: () => {
      toast.success("Battle ended successfully!");
      queryClient.invalidateQueries({ queryKey: ['battle', battleId] });
    },
    onError: (error: any) => {
      console.error("Error ending battle:", error);
      toast.error("Failed to end battle. Please try again.");
    }
  });

  // Mutation to submit feedback
  const submitFeedbackMutation = useMutation({
    mutationFn: async () => {
      if (!battleId || !user?.id) throw new Error("Battle ID and User ID are required");
      
      const { data, error } = await supabase
        .from('solution_feedback')
        .insert([
          {
            battle_id: battleId,
            user_id: user.id,
            feedback: solutionFeedback,
          }
        ])
        .select()
        .single();
      
      if (error) {
        console.error("Supabase error:", error);
        throw error;
      }
      
      return data;
    },
    onSuccess: () => {
      toast.success("Feedback submitted successfully!");
      setFeedbackDialogOpen(false);
    },
    onError: (error: any) => {
      console.error("Error submitting feedback:", error);
      toast.error("Failed to submit feedback. Please try again.");
    }
  });

  // Update battle state based on battle data
  useEffect(() => {
    if (battle) {
      setIsBattleReady(battle.status === 'in_progress' || battle.status === 'completed');
      setIsBattleActive(battle.status === 'in_progress');
      setIsBattleOver(battle.status === 'completed');
      
      if (battle.language) {
        setLanguage(battle.language);
      }

      if (battle.status === 'completed') {
        const setParticipants = async () => {
          if (battle.winner_id) {
            const { data: winnerData, error: winnerError } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', battle.winner_id)
              .single();

            if (winnerError) {
              console.error("Supabase error:", winnerError);
            } else if (winnerData) {
              setWinner({
                id: winnerData.id,
                name: winnerData.name,
                avatar_url: winnerData.avatar_url,
                rating: winnerData.rating,
              });

              const loserId = battle.creator_id === battle.winner_id ? battle.defender_id : battle.creator_id;

              if (loserId) {
                const { data: loserData, error: loserError } = await supabase
                  .from('profiles')
                  .select('*')
                  .eq('id', loserId)
                  .single();

                if (loserError) {
                  console.error("Supabase error:", loserError);
                } else if (loserData) {
                  setLoser({
                    id: loserData.id,
                    name: loserData.name,
                    avatar_url: loserData.avatar_url,
                    rating: loserData.rating,
                  });
                }
              }
            }
          }
        };
        setParticipants();
      }
    }
  }, [battle]);

  // Handle time remaining and battle end
  useEffect(() => {
    if (battle && battle.duration && battle.start_time && isBattleActive) {
      const calculateTimeRemaining = () => {
        if (!battle?.start_time) return;
        
        const startTime = new Date(battle.start_time).getTime();
        const endTime = startTime + battle.duration * 60 * 1000;
        const now = new Date().getTime();
        const timeLeft = endTime - now;

        if (timeLeft > 0) {
          setTimeRemaining(Math.ceil(timeLeft / 1000));
        } else {
          setTimeRemaining(0);
          if (!battle.winner_id && user) {
            // Determine winner automatically if time runs out
            const determineWinner = async () => {
              if (!solution) {
                const opponentId = battle.creator_id === user.id ? battle.defender_id : battle.creator_id;
                if (opponentId) {
                  await endBattleMutation.mutateAsync(opponentId);
                }
              } else {
                await endBattleMutation.mutateAsync(user.id);
              }
            };
            determineWinner();
          }
        }
      };

      calculateTimeRemaining();
      const intervalId = setInterval(calculateTimeRemaining, 1000);

      return () => clearInterval(intervalId);
    }
  }, [battle, isBattleActive, user, solution, endBattleMutation]);

  // Initialize code with solution if exists
  useEffect(() => {
    if (solution && solution.code) {
      setCode(solution.code);
    }
  }, [solution]);

  const handleJoinBattle = async () => {
    if (!user) {
      toast.error("You must be logged in to join a battle");
      navigate('/login');
      return;
    }
    
    try {
      await joinBattleMutation.mutateAsync();
    } catch (error) {
      console.error("Error joining battle:", error);
    }
  };

  const handleSubmitSolution = async () => {
    if (!code.trim()) {
      toast.error("Your solution cannot be empty");
      return;
    }
    
    setIsSubmitting(true);
    try {
      await submitSolutionMutation.mutateAsync();
    } catch (error) {
      console.error("Error submitting solution:", error);
    }
  };

  const handleEndBattle = async (winnerId: string) => {
    try {
      await endBattleMutation.mutateAsync(winnerId);
    } catch (error) {
      console.error("Error ending battle:", error);
    }
  };

  const handleCopyCode = () => {
    if (solution) {
      navigator.clipboard.writeText(solution.code)
        .then(() => {
          setIsCodeCopied(true);
          toast.success("Code copied to clipboard!");
          setTimeout(() => setIsCodeCopied(false), 3000);
        })
        .catch(err => {
          console.error("Failed to copy code: ", err);
          toast.error("Failed to copy code. Please try again.");
        });
    }
  };

  const handleEditorDidMount = (editor: any) => {
    editorRef.current = editor;
    setIsEditorReady(true);
  };

  if (isBattleLoading || isProblemLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="w-10 h-10 animate-spin text-icon-accent" />
        <span className="ml-2 text-lg">Loading battle details...</span>
      </div>
    );
  }

  if (!battle) {
    return (
      <div className="flex flex-col justify-center items-center h-screen">
        <XCircle className="w-16 h-16 text-red-500 mb-4" />
        <h2 className="text-2xl font-bold mb-2">Battle not found</h2>
        <p className="text-icon-light-gray mb-6">The battle you're looking for doesn't exist or has been deleted.</p>
        <Button onClick={() => navigate('/join-battle')}>Browse Battles</Button>
      </div>
    );
  }

  const isCreator = user?.id === battle?.creator_id;
  const isDefender = user?.id === battle?.defender_id;
  const hasJoined = isCreator || isDefender;
  const canJoin = !hasJoined && battle?.status === 'waiting';
  const canSubmit = hasJoined && isBattleActive && !solution;
  const canEnd = hasJoined && isBattleActive && solution;
  const hasEnded = battle?.status === 'completed';
  const isRated = battle?.is_rated;

  const getLanguageMode = (language: string) => {
    switch (language.toLowerCase()) {
      case 'javascript':
        return 'javascript';
      case 'python':
        return 'python';
      case 'java':
        return 'java';
      case 'c++':
      case 'cpp':
        return 'cpp';
      case 'c#':
      case 'csharp':
        return 'csharp';
      default:
        return 'javascript';
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty.toLowerCase()) {
      case 'easy':
        return 'bg-green-500';
      case 'medium':
        return 'bg-yellow-500';
      case 'hard':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getDifficultyPoints = (difficulty: string) => {
    switch (difficulty.toLowerCase()) {
      case 'easy':
        return '10';
      case 'medium':
        return '25';
      case 'hard':
        return '50';
      default:
        return '0';
    }
  };

  const getStatusIcon = (status: string): React.ReactNode => {
    switch (status) {
      case 'waiting':
        return <HelpCircle className="w-4 h-4" />;
      case 'in_progress':
        return <Loader2 className="w-4 h-4 animate-spin" />;
      case 'completed':
        return <ShieldCheck className="w-4 h-4" />;
      default:
        return <HelpCircle className="w-4 h-4" />;
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">{problem?.title}</h1>
        <div className="flex items-center gap-1 mt-2">
          <Badge className={getDifficultyColor(battle?.difficulty || 'easy')}>{battle?.difficulty}</Badge>
          {battle && (
            <div className="flex items-center gap-1">
              {battle.is_rated ? (
                <Badge className="bg-icon-accent text-black">Rated</Badge>
              ) : (
                <Badge variant="outline">Casual</Badge>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel: Problem Description */}
        <div className="lg:col-span-1">
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="problem-description">
              <AccordionTrigger className="text-lg font-semibold">
                Problem Description
              </AccordionTrigger>
              <AccordionContent>
                <Card className="bg-icon-dark-gray border-icon-gray">
                  <CardHeader>
                    <CardTitle className="text-md font-bold">
                      {problem?.title}
                    </CardTitle>
                    <CardDescription>
                      Solve the problem using {battle?.language}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <h3 className="text-md font-semibold">Question</h3>
                      <p className="text-sm text-icon-light-gray">{problem?.question}</p>
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-md font-semibold">Examples</h3>
                      <ul className="list-disc pl-5 text-sm text-icon-light-gray">
                        {problem?.examples?.map((example, index) => (
                          <li key={index}>{example}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-md font-semibold">Constraints</h3>
                      <ul className="list-disc pl-5 text-sm text-icon-light-gray">
                        {problem?.constraints?.map((constraint, index) => (
                          <li key={index}>{constraint}</li>
                        ))}
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="battle-details">
              <AccordionTrigger className="text-lg font-semibold">
                Battle Details
              </AccordionTrigger>
              <AccordionContent>
                <Card className="bg-icon-dark-gray border-icon-gray">
                  <CardHeader>
                    <CardTitle className="text-md font-bold">
                      Battle Information
                    </CardTitle>
                    <CardDescription>
                      Details about the current battle.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm text-icon-light-gray">
                          <span className="font-medium">Language</span>
                          <p className="text-xs opacity-80">{battle?.language}</p>
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-icon-light-gray">
                          <span className="font-medium">Difficulty</span>
                          <p className="text-xs opacity-80">{battle?.difficulty} ({getDifficultyPoints(battle?.difficulty || 'easy')} points)</p>
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-icon-light-gray">
                          <span className="font-medium">Duration</span>
                          <p className="text-xs opacity-80">{battle?.duration} minutes</p>
                        </div>
                      </div>
                      {battle && (
                        <div>
                          {battle.is_rated && (
                            <div className="text-sm text-icon-light-gray">
                              <span className="font-medium">Rated Battle</span>
                              <p className="text-xs opacity-80">
                                Win or lose will affect your rating
                              </p>
                            </div>
                          )}
                          {!battle.is_rated && (
                            <div className="text-sm text-icon-light-gray">
                              <span className="font-medium">Casual Battle</span>
                              <p className="text-xs opacity-80">
                                Will not affect your rating
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm text-icon-light-gray">
                          <span className="font-medium">Status</span>
                          <div className="flex items-center gap-2">
                            <p className="text-xs opacity-80">{battle?.status}</p>
                            {getStatusIcon(battle?.status || 'waiting')}
                          </div>
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-icon-light-gray">
                          <span className="font-medium">Created At</span>
                          <p className="text-xs opacity-80">
                            {battle?.created_at && format(new Date(battle.created_at), 'MMM dd, yyyy HH:mm')}
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        {/* Middle Panel: Code Editor */}
        <div className="lg:col-span-2">
          <Card className="bg-icon-dark-gray border-icon-gray h-full flex flex-col">
            <CardHeader>
              <CardTitle className="text-md font-bold">Code Editor</CardTitle>
              <CardDescription>Write your solution here.</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow">
              <Editor
                height="500px"
                defaultLanguage={getLanguageMode(battle?.language || 'javascript')}
                language={getLanguageMode(battle?.language || 'javascript')}
                value={code}
                theme="vs-dark"
                onChange={(value) => {
                  if (value) {
                    setCode(value);
                  }
                }}
                onMount={handleEditorDidMount}
                options={{
                  minimap: { enabled: false },
                  wordWrap: 'on',
                  fontSize: '14px',
                  scrollBeyondLastLine: false,
                }}
              />
            </CardContent>
            <CardFooter className="flex justify-between items-center">
              {timeRemaining !== null && isBattleActive && (
                <div className="text-sm text-icon-light-gray">
                  Time Remaining: <span className="font-medium">{Math.floor(timeRemaining / 60)}:{String(timeRemaining % 60).padStart(2, '0')}</span>
                </div>
              )}
              <div>
                {canJoin && (
                  <Button onClick={handleJoinBattle} disabled={joinBattleMutation.isPending}>
                    {joinBattleMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Joining...
                      </>
                    ) : (
                      <>
                        <PlayCircle className="mr-2 h-4 w-4" />
                        Join Battle
                      </>
                    )}
                  </Button>
                )}
                {canSubmit && (
                  <Button
                    onClick={handleSubmitSolution}
                    disabled={isSubmitting || !isEditorReady || !code.trim()}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Submit Solution
                      </>
                    )}
                  </Button>
                )}
                {canEnd && isCreator && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline">
                        End Battle <ChevronsUpDown className="ml-2 h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="bg-icon-dark-gray border-icon-gray">
                      <DropdownMenuLabel>Select Winner</DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => handleEndBattle(battle.creator_id)}>
                        <div className="flex items-center">
                          <Avatar className="mr-2 h-5 w-5">
                            <AvatarImage src={creator?.avatar_url || ""} />
                            <AvatarFallback>{creator?.name?.charAt(0) || "C"}</AvatarFallback>
                          </Avatar>
                          <span>{creator?.name || "Creator"}</span>
                        </div>
                      </DropdownMenuItem>
                      {battle.defender_id && (
                        <DropdownMenuItem onClick={() => handleEndBattle(battle.defender_id)}>
                          <div className="flex items-center">
                            <Avatar className="mr-2 h-5 w-5">
                              <AvatarImage src={defender?.avatar_url || ""} />
                              <AvatarFallback>{defender?.name?.charAt(0) || "D"}</AvatarFallback>
                            </Avatar>
                            <span>{defender?.name || "Defender"}</span>
                          </div>
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                {canEnd && isDefender && (
                  <Button onClick={() => user && handleEndBattle(user.id)}>
                    <XCircle className="mr-2 h-4 w-4" />
                    End Battle
                  </Button>
                )}
              </div>
            </CardFooter>
          </Card>
        </div>
      </div>

      {/* Battle Result Section */}
      {hasEnded && (
        <div className="mt-8">
          <h2 className="text-xl font-bold text-white mb-4">Battle Result</h2>
          <Card className="bg-icon-dark-gray border-icon-gray">
            <CardHeader>
              <CardTitle className="text-md font-bold">
                {winner ? `${winner.name} wins!` : 'Battle ended without a winner.'}
              </CardTitle>
              <CardDescription>
                Details of the battle result.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-icon-light-gray">
                    <span className="font-medium">Winner</span>
                    {winner ? (
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={winner.avatar_url || ""} />
                          <AvatarFallback>{winner.name?.charAt(0) || "W"}</AvatarFallback>
                        </Avatar>
                        <p className="text-xs opacity-80">{winner.name}</p>
                      </div>
                    ) : (
                      <p className="text-xs opacity-80">No winner</p>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-icon-light-gray">
                    <span className="font-medium">Loser</span>
                    {loser ? (
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={loser.avatar_url || ""} />
                          <AvatarFallback>{loser.name?.charAt(0) || "L"}</AvatarFallback>
                        </Avatar>
                        <p className="text-xs opacity-80">{loser.name}</p>
                      </div>
                    ) : (
                      <p className="text-xs opacity-80">No loser</p>
                    )}
                  </div>
                </div>
              </div>
              {solution && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <h3 className="text-md font-semibold">Your Solution</h3>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleCopyCode}
                      disabled={!solution || isCodeCopied}
                    >
                      {isCodeCopied ? (
                        <>
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="mr-2 h-4 w-4" />
                          Copy Code
                        </>
                      )}
                    </Button>
                  </div>
                  <div className="bg-icon-gray/50 rounded-md p-4">
                    <pre className="text-sm text-icon-light-gray whitespace-pre-wrap">
                      <code>{solution.code}</code>
                    </pre>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Feedback Dialog */}
      <div className="mt-6">
        <Dialog open={feedbackDialogOpen} onOpenChange={setFeedbackDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline">Submit Feedback</Button>
          </DialogTrigger>
          <DialogContent className="bg-icon-dark-gray border-icon-gray">
            <DialogHeader>
              <DialogTitle>Solution Feedback</DialogTitle>
              <DialogDescription>
                Share your thoughts on the provided solution.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <label htmlFor="feedback" className="text-sm font-medium">
                  Feedback
                </label>
                <Textarea
                  id="feedback"
                  value={solutionFeedback}
                  onChange={(e) => setSolutionFeedback(e.target.value)}
                  className="min-h-[100px] bg-icon-gray"
                  placeholder="Share your thoughts about the battle or solution"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={() => submitFeedbackMutation.mutate()} disabled={submitFeedbackMutation.isPending}>
                {submitFeedbackMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit Feedback"
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default BattleArena;
