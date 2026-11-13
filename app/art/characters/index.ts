/**
 * The people of the career scene (`docs/API_ART.md`, "Characters"): the footballer,
 * adult and youth, the goalkeeper, the match ball, the trophy and a dust puff.
 */

export {
  HERO_LOOK,
  KIT_BASES,
  litKit,
  makeKit,
  type Kit,
  type KitBase,
} from "./kit";
export {
  BICYCLE_CELL,
  BICYCLE_YOUTH_CELL,
  KEEPER_ANIMS,
  KICK_STRIKE_FRAME,
  PLAYER_ANIMS,
  SHOT_ANIMS,
  SPRAWL_CELL,
  STRIKE_FRAME,
  ballSpot,
  drawKeeper,
  drawPlayer,
  handsSpot,
  keeperCell,
  keeperHands,
  playerCell,
  type Cell,
  type KeeperAnim,
  type PlayerAnim,
  type ShotAnim,
} from "./people";
export { drawBallRing, drawMatchBall, drawPuff, drawTrophy } from "./props";
