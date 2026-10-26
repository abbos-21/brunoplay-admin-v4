export interface Prize { place: number; coins: number; stars: number; gift: string }

export const METRICS: Record<string, string> = {
  STARS_SPENT: 'Stars spent in games',
  RIDE_BEST: 'Best Ride score',
  COINS_MINED: 'Coins mined',
  FRIENDS_INVITED: 'Friends invited',
}
