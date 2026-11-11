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
  KEEPER_ANIMS,
  KICK_STRIKE_FRAME,
  PLAYER_ANIMS,
  ballSpot,
  drawKeeper,
  drawPlayer,
  handsSpot,
  keeperHands,
  type KeeperAnim,
  type PlayerAnim,
} from "./people";
export { drawMatchBall, drawPuff, drawTrophy } from "./props";
