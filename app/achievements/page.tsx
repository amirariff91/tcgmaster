'use client';

import * as React from 'react';
import {
  Trophy,
  Star,
  Award,
  Target,
  Zap,
  Crown,
  Medal,
  Flame,
  Diamond,
  Lock,
  Check,
  ChevronRight,
  BarChart3,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatPrice, formatDate, cn } from '@/lib/utils';

// Achievement types and mock data
type AchievementCategory = 'collection' | 'investment' | 'grading' | 'milestone' | 'special';

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: keyof typeof iconMap;
  category: AchievementCategory;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  progress?: number;
  max_progress?: number;
  earned_at?: string;
  points: number;
}

const iconMap = {
  trophy: Trophy,
  star: Star,
  award: Award,
  target: Target,
  zap: Zap,
  crown: Crown,
  medal: Medal,
  flame: Flame,
  diamond: Diamond,
};

// Helper function to get rarity gradient classes
function getRarityGradient(rarity: Achievement['rarity']) {
  switch (rarity) {
    case 'common':
      return 'from-zinc-400 to-zinc-500';
    case 'rare':
      return 'from-blue-400 to-blue-600';
    case 'epic':
      return 'from-purple-400 to-purple-600';
    case 'legendary':
      return 'from-amber-400 to-orange-500';
    default:
      return 'from-zinc-400 to-zinc-500';
  }
}

// Helper function to get rarity background classes
function getRarityBg(rarity: Achievement['rarity']) {
  switch (rarity) {
    case 'common':
      return 'bg-zinc-100';
    case 'rare':
      return 'bg-blue-50';
    case 'epic':
      return 'bg-purple-50';
    case 'legendary':
      return 'bg-amber-50';
    default:
      return 'bg-zinc-100';
  }
}

const mockAchievements: Achievement[] = [
  // Collection Achievements
  {
    id: '1',
    name: 'First Card',
    description: 'Add your first card to a collection',
    icon: 'star',
    category: 'collection',
    rarity: 'common',
    earned_at: '2024-01-05',
    points: 10,
  },
  {
    id: '2',
    name: 'Collector',
    description: 'Add 10 cards to your collection',
    icon: 'award',
    category: 'collection',
    rarity: 'common',
    progress: 10,
    max_progress: 10,
    earned_at: '2024-01-10',
    points: 25,
  },
  {
    id: '3',
    name: 'Serious Collector',
    description: 'Add 50 cards to your collection',
    icon: 'trophy',
    category: 'collection',
    rarity: 'rare',
    progress: 47,
    max_progress: 50,
    points: 50,
  },
  {
    id: '4',
    name: 'Master Collector',
    description: 'Add 100 cards to your collection',
    icon: 'crown',
    category: 'collection',
    rarity: 'epic',
    progress: 47,
    max_progress: 100,
    points: 100,
  },
  // Investment Achievements
  {
    id: '5',
    name: 'Investor',
    description: 'Portfolio value reaches $1,000',
    icon: 'medal',
    category: 'investment',
    rarity: 'common',
    earned_at: '2024-01-08',
    points: 25,
  },
  {
    id: '6',
    name: 'Serious Investor',
    description: 'Portfolio value reaches $10,000',
    icon: 'trophy',
    category: 'investment',
    rarity: 'rare',
    earned_at: '2024-01-15',
    points: 75,
  },
  {
    id: '7',
    name: 'Big Spender',
    description: 'Portfolio value reaches $100,000',
    icon: 'diamond',
    category: 'investment',
    rarity: 'epic',
    progress: 125000,
    max_progress: 100000,
    earned_at: '2024-01-18',
    points: 200,
  },
  {
    id: '8',
    name: 'Whale',
    description: 'Portfolio value reaches $1,000,000',
    icon: 'crown',
    category: 'investment',
    rarity: 'legendary',
    progress: 125000,
    max_progress: 1000000,
    points: 500,
  },
  // Grading Achievements
  {
    id: '9',
    name: 'First Gem',
    description: 'Add your first PSA 10 or BGS 10 to your collection',
    icon: 'diamond',
    category: 'grading',
    rarity: 'rare',
    earned_at: '2024-01-12',
    points: 50,
  },
  {
    id: '10',
    name: 'Grade Collector',
    description: 'Own a card in 5 different grades',
    icon: 'target',
    category: 'grading',
    rarity: 'rare',
    progress: 3,
    max_progress: 5,
    points: 75,
  },
  {
    id: '11',
    name: 'Grading Expert',
    description: 'Lookup 25 different certs',
    icon: 'zap',
    category: 'grading',
    rarity: 'common',
    progress: 12,
    max_progress: 25,
    points: 30,
  },
  // Milestone Achievements
  {
    id: '12',
    name: 'Set Completionist',
    description: 'Complete any card set',
    icon: 'flame',
    category: 'milestone',
    rarity: 'epic',
    progress: 0,
    max_progress: 1,
    points: 150,
  },
  {
    id: '13',
    name: 'Diversified',
    description: 'Own cards from 5 different games/sports',
    icon: 'target',
    category: 'milestone',
    rarity: 'rare',
    progress: 2,
    max_progress: 5,
    points: 50,
  },
  // Special Achievements
  {
    id: '14',
    name: 'Early Adopter',
    description: 'Join TCGMaster during beta',
    icon: 'star',
    category: 'special',
    rarity: 'legendary',
    earned_at: '2024-01-01',
    points: 100,
  },
];

// Mock set completion data
const mockSetProgress = [
  {
    id: '1',
    name: 'Base Set',
    game: 'Pokemon',
    total_cards: 102,
    owned_cards: 87,
    completion_percent: 85.3,
    missing_cards: [
      { name: 'Charizard', number: '4', price: 42000 },
      { name: 'Venusaur', number: '15', price: 1200 },
      { name: 'Blastoise', number: '2', price: 8500 },
    ],
    estimated_completion_cost: 51700,
  },
  {
    id: '2',
    name: 'Jungle',
    game: 'Pokemon',
    total_cards: 64,
    owned_cards: 64,
    completion_percent: 100,
    missing_cards: [],
    estimated_completion_cost: 0,
  },
  {
    id: '3',
    name: 'Fossil',
    game: 'Pokemon',
    total_cards: 62,
    owned_cards: 45,
    completion_percent: 72.6,
    missing_cards: [
      { name: 'Gengar', number: '5', price: 850 },
      { name: 'Dragonite', number: '4', price: 1200 },
    ],
    estimated_completion_cost: 3200,
  },
  {
    id: '4',
    name: '1986-87 Fleer',
    game: 'Basketball',
    total_cards: 132,
    owned_cards: 15,
    completion_percent: 11.4,
    missing_cards: [
      { name: 'Michael Jordan', number: '57', price: 450000 },
      { name: 'Charles Barkley', number: '7', price: 8000 },
    ],
    estimated_completion_cost: 520000,
  },
];

// Mock challenges
const mockChallenges = [
  {
    id: '1',
    name: 'January Collector Challenge',
    description: 'Add 5 new cards to your collection this month',
    progress: 3,
    max_progress: 5,
    ends_at: '2024-01-31',
    reward_points: 50,
    reward_badge: 'January Collector',
  },
  {
    id: '2',
    name: 'Vintage Hunter',
    description: 'Add a card from before 2000 to your collection',
    progress: 0,
    max_progress: 1,
    ends_at: '2024-02-15',
    reward_points: 75,
    reward_badge: 'Vintage Hunter',
  },
];

function AchievementCard({ achievement }: { achievement: Achievement }) {
  const Icon = iconMap[achievement.icon];
  const isEarned = !!achievement.earned_at;
  const progress = achievement.progress ?? 0;
  const maxProgress = achievement.max_progress ?? 1;
  const progressPercent = Math.min((progress / maxProgress) * 100, 100);

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border p-4 transition-all',
        isEarned
          ? cn('border-transparent', getRarityBg(achievement.rarity))
          : 'border-zinc-200 bg-white'
      )}
    >
      {isEarned && (
        <div className="absolute -right-4 -top-4 h-16 w-16">
          <div
            className={cn(
              'absolute h-full w-full rotate-45 bg-gradient-to-r',
              getRarityGradient(achievement.rarity)
            )}
          />
          <Check className="absolute bottom-1 left-1 h-4 w-4 text-white" />
        </div>
      )}

      <div className="flex items-start gap-4">
        <div
          className={cn(
            'flex h-12 w-12 items-center justify-center rounded-xl',
            isEarned
              ? cn('bg-gradient-to-br', getRarityGradient(achievement.rarity))
              : 'bg-zinc-100'
          )}
        >
          {isEarned ? (
            <Icon className="h-6 w-6 text-white" />
          ) : (
            <Lock className="h-5 w-5 text-zinc-400" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3
              className={cn(
                'font-semibold',
                isEarned ? 'text-zinc-900' : 'text-zinc-500'
              )}
            >
              {achievement.name}
            </h3>
            <Badge
              variant="outline"
              className={cn(
                'text-xs capitalize',
                !isEarned && 'border-zinc-300 text-zinc-400'
              )}
            >
              {achievement.rarity}
            </Badge>
          </div>
          <p
            className={cn(
              'mt-1 text-sm',
              isEarned ? 'text-zinc-600' : 'text-zinc-400'
            )}
          >
            {achievement.description}
          </p>

          {!isEarned && achievement.max_progress && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-500">
                  {progress.toLocaleString()} / {maxProgress.toLocaleString()}
                </span>
                <span className="text-zinc-400">{progressPercent.toFixed(0)}%</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-zinc-200">
                <div
                  className="h-full bg-blue-500 transition-all"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}

          {isEarned && achievement.earned_at && (
            <p className="mt-2 text-xs text-zinc-400">
              Earned {formatDate(achievement.earned_at)}
            </p>
          )}
        </div>

        <div className="text-right">
          <span
            className={cn(
              'text-sm font-bold',
              isEarned ? 'text-emerald-600' : 'text-zinc-300'
            )}
          >
            +{achievement.points}
          </span>
          <p className="text-xs text-zinc-400">pts</p>
        </div>
      </div>
    </div>
  );
}

export default function AchievementsPage() {
  const [activeTab, setActiveTab] = React.useState<'achievements' | 'sets' | 'challenges'>(
    'achievements'
  );
  const [categoryFilter, setCategoryFilter] = React.useState<AchievementCategory | 'all'>('all');
  const [daysLeftMap, setDaysLeftMap] = React.useState<Record<string, number>>({});

  // Calculate days left on client-side only to avoid hydration mismatch
  React.useEffect(() => {
    const now = Date.now();
    const map = mockChallenges.reduce(
      (acc, challenge) => {
        acc[challenge.id] = Math.ceil(
          (new Date(challenge.ends_at).getTime() - now) / (1000 * 60 * 60 * 24)
        );
        return acc;
      },
      {} as Record<string, number>
    );
    setDaysLeftMap(map);
  }, []);

  const earnedAchievements = mockAchievements.filter((a) => a.earned_at);
  const totalPoints = earnedAchievements.reduce((sum, a) => sum + a.points, 0);
  const maxPoints = mockAchievements.reduce((sum, a) => sum + a.points, 0);

  const filteredAchievements =
    categoryFilter === 'all'
      ? mockAchievements
      : mockAchievements.filter((a) => a.category === categoryFilter);

  return (
    <div className="min-h-screen pb-16">
      {/* Header */}
      <div className="border-b border-zinc-200 bg-gradient-to-b from-zinc-50 to-white">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-zinc-900">
                Achievements
              </h1>
              <p className="mt-1 text-zinc-500">Track your collecting milestones</p>
            </div>

            {/* Points Summary */}
            <div className="flex items-center gap-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-zinc-900">
                  {totalPoints}
                </p>
                <p className="text-sm text-zinc-500">Points Earned</p>
              </div>
              <div className="h-12 w-px bg-zinc-200" />
              <div className="text-center">
                <p className="text-3xl font-bold text-zinc-900">
                  {earnedAchievements.length}
                  <span className="text-lg text-zinc-400">/{mockAchievements.length}</span>
                </p>
                <p className="text-sm text-zinc-500">Badges Earned</p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-6 flex gap-2">
            {(['achievements', 'sets', 'challenges'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                  activeTab === tab
                    ? 'bg-zinc-900 text-white'
                    : 'text-zinc-600 hover:bg-zinc-100'
                )}
              >
                {tab === 'achievements' && (
                  <>
                    <Trophy className="mr-2 inline h-4 w-4" />
                    Achievements
                  </>
                )}
                {tab === 'sets' && (
                  <>
                    <BarChart3 className="mr-2 inline h-4 w-4" />
                    Set Completion
                  </>
                )}
                {tab === 'challenges' && (
                  <>
                    <Target className="mr-2 inline h-4 w-4" />
                    Challenges
                  </>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Achievements Tab */}
        {activeTab === 'achievements' && (
          <>
            {/* Category Filter */}
            <div className="mb-6 flex flex-wrap gap-2">
              {(['all', 'collection', 'investment', 'grading', 'milestone', 'special'] as const).map(
                (cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                    className={cn(
                      'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
                      categoryFilter === cat
                        ? 'bg-zinc-900 text-white'
                        : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                    )}
                  >
                    {cat === 'all' ? 'All' : cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </button>
                )
              )}
            </div>

            {/* Achievements Grid */}
            <div className="grid gap-4 md:grid-cols-2">
              {filteredAchievements.map((achievement) => (
                <AchievementCard key={achievement.id} achievement={achievement} />
              ))}
            </div>
          </>
        )}

        {/* Set Completion Tab */}
        {activeTab === 'sets' && (
          <div className="space-y-4">
            {mockSetProgress.map((set) => (
              <Card key={set.id}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-zinc-900">
                          {set.name}
                        </h3>
                        <Badge variant="secondary">{set.game}</Badge>
                        {set.completion_percent === 100 && (
                          <Badge variant="success" className="gap-1">
                            <Check className="h-3 w-3" />
                            Complete
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-zinc-500">
                        {set.owned_cards} of {set.total_cards} cards collected
                      </p>

                      {/* Progress Bar */}
                      <div className="mt-4">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-zinc-600">
                            {set.completion_percent.toFixed(1)}% complete
                          </span>
                          {set.completion_percent < 100 && (
                            <span className="text-zinc-500">
                              Est. cost to complete: {formatPrice(set.estimated_completion_cost)}
                            </span>
                          )}
                        </div>
                        <div className="mt-2 h-3 overflow-hidden rounded-full bg-zinc-100">
                          <div
                            className={cn(
                              'h-full transition-all',
                              set.completion_percent === 100 ? 'bg-emerald-500' : 'bg-blue-500'
                            )}
                            style={{ width: `${set.completion_percent}%` }}
                          />
                        </div>
                      </div>

                      {/* Missing Cards Preview */}
                      {set.missing_cards.length > 0 && (
                        <div className="mt-4">
                          <p className="mb-2 text-sm font-medium text-zinc-700">
                            Missing Cards ({set.total_cards - set.owned_cards})
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {set.missing_cards.slice(0, 3).map((card) => (
                              <span
                                key={card.number}
                                className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-3 py-1 text-sm"
                              >
                                <span className="text-zinc-600">
                                  #{card.number}
                                </span>
                                <span className="font-medium text-zinc-900">
                                  {card.name}
                                </span>
                                <span className="text-emerald-600">
                                  {formatPrice(card.price)}
                                </span>
                              </span>
                            ))}
                            {set.missing_cards.length > 3 && (
                              <span className="inline-flex items-center rounded-full bg-zinc-100 px-3 py-1 text-sm text-zinc-500">
                                +{set.missing_cards.length - 3} more
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    <Button variant="outline" size="sm">
                      View Set
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Challenges Tab */}
        {activeTab === 'challenges' && (
          <div className="space-y-4">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-zinc-900">
                Active Challenges
              </h2>
              <p className="text-sm text-zinc-500">
                Complete challenges to earn bonus points and exclusive badges
              </p>
            </div>

            {mockChallenges.map((challenge) => {
              const daysLeft = daysLeftMap[challenge.id] ?? 0;
              const progressPercent = (challenge.progress / challenge.max_progress) * 100;

              return (
                <Card key={challenge.id}>
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-400 to-purple-500">
                        <Target className="h-6 w-6 text-white" />
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold text-zinc-900">
                            {challenge.name}
                          </h3>
                          <Badge
                            variant={daysLeft <= 7 ? 'warning' : 'secondary'}
                          >
                            {daysLeft} days left
                          </Badge>
                        </div>
                        <p className="mt-1 text-sm text-zinc-500">{challenge.description}</p>

                        {/* Progress */}
                        <div className="mt-4">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-zinc-600">
                              {challenge.progress} / {challenge.max_progress}
                            </span>
                            <span className="text-zinc-400">{progressPercent.toFixed(0)}%</span>
                          </div>
                          <div className="mt-1 h-2 overflow-hidden rounded-full bg-zinc-100">
                            <div
                              className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all"
                              style={{ width: `${progressPercent}%` }}
                            />
                          </div>
                        </div>

                        {/* Rewards */}
                        <div className="mt-4 flex items-center gap-4">
                          <div className="flex items-center gap-2 text-sm">
                            <Star className="h-4 w-4 text-amber-500" />
                            <span className="text-zinc-600">
                              +{challenge.reward_points} points
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <Medal className="h-4 w-4 text-purple-500" />
                            <span className="text-zinc-600">
                              &quot;{challenge.reward_badge}&quot; badge
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {/* Completed Challenges */}
            <div className="mt-8">
              <h2 className="mb-4 text-lg font-semibold text-zinc-900">
                Completed Challenges
              </h2>
              <div className="rounded-lg border border-dashed border-zinc-300 p-8 text-center">
                <Trophy className="mx-auto h-12 w-12 text-zinc-300" />
                <p className="mt-3 text-zinc-500">No completed challenges yet</p>
                <p className="mt-1 text-sm text-zinc-400">
                  Complete active challenges to see them here
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
