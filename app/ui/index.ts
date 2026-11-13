// The interface kit: the DOM skin of the game. Presentational only (props in, events out).
// Styles live in ui.css and tokens.css, loaded globally from app/app.css.

export { AnswerBar } from "./AnswerBar";
export type { AnswerBarLabels, AnswerBarProps } from "./AnswerBar";
export { Board } from "./Board";
export type { BoardLabels, BoardProps } from "./Board";
export { Button, IconButton } from "./Button";
export { BURST_FRAMES, ClickBurst, MAX_BURSTS } from "./ClickBurst";
export type {
  ButtonProps,
  ButtonVariant,
  ForcedState,
  IconButtonProps,
} from "./Button";
export { FullTimeCard, FullTimeResults } from "./FullTimeCard";
export type {
  FullTimeCardProps,
  FullTimeResult,
  FullTimeResultsProps,
} from "./FullTimeCard";
export { GameLayout } from "./GameLayout";
export type { GameLayoutProps } from "./GameLayout";
export { HowToPlay, HowToPlayCard } from "./HowToPlay";
export type {
  HowToPlayCardProps,
  HowToPlayLabels,
  HowToPlayProps,
  HowToPlayShot,
  HowToPlayTier,
} from "./HowToPlay";
export { LeagueTable } from "./LeagueTable";
export type {
  LeagueEntry,
  LeagueGap,
  LeagueRow,
  LeagueTableLabels,
  LeagueTableProps,
} from "./LeagueTable";
export { Leaderboard, TROPHY } from "./Leaderboard";
export type {
  LeaderboardBoard,
  LeaderboardEntry,
  LeaderboardLabels,
  LeaderboardProps,
} from "./Leaderboard";
export { LedNumber } from "./LedNumber";
export type { LedNumberProps, LedSize, LedTone } from "./LedNumber";
export { MenuCaptions } from "./MenuCaptions";
export type { MenuCaptionsProps, MenuModeCaption } from "./MenuCaptions";
export { ModeBadge } from "./ModeBadge";
export type { ModeBadgeProps } from "./ModeBadge";
export { Panel } from "./Panel";
export type { PanelProps } from "./Panel";
export { PixelGlyph, bitmapPath, bitmapSize } from "./PixelGlyph";
export type { Bitmap, GlyphLayer, PixelGlyphProps } from "./PixelGlyph";
export { PixelRoot } from "./PixelRoot";
export type { PixelRootProps } from "./PixelRoot";
export { PixelStage } from "./PixelStage";
export type { PixelStageProps } from "./PixelStage";
export { Popup, PopupButton } from "./Popup";
export type { PopupButtonProps, PopupProps } from "./Popup";
export { BELL, RemindMe } from "./RemindMe";
export type { RemindMeLabels, RemindMeProps } from "./RemindMe";
export { REVIEW_ICON, SHARE_ICON, TICK_ICON } from "./ResultIcons";
export { Review } from "./Review";
export type { ReviewLabels, ReviewProps } from "./Review";
export {
  DEFAULT_REMINDER_TIME,
  REMINDER_FILE,
  REMINDER_TIMES,
  firstReminder,
  googleCalendarUrl,
  outlookCalendarUrl,
  reminderIcs,
} from "./reminder";
export type { ReminderEvent } from "./reminder";
export { BULB, CUP, HEART, Support } from "./Support";
export type { SupportLabels, SupportProps } from "./Support";
export {
  STATS_BAR_CELLS,
  STATS_ICON,
  Stats,
  StatsButton,
  StatsCard,
} from "./Stats";
export type {
  StatsButtonProps,
  StatsCardProps,
  StatsLabels,
  StatsModeView,
  StatsProps,
  StatsShot,
  StatsTally,
} from "./Stats";
export { SoundToggle, SPEAKER_OFF, SPEAKER_ON } from "./SoundToggle";
export { FLAME, SPARKS, Streak } from "./Streak";
export type { StreakProps } from "./Streak";
export type { SoundToggleLabels, SoundToggleProps } from "./SoundToggle";
export { Pip, Pips } from "./Pips";
export type { PipProps, PipState, PipsProps } from "./Pips";
export { RevealSheet } from "./RevealSheet";
export type { RevealSheetProps, RevealYours } from "./RevealSheet";
export { TierBar } from "./TierBar";
export type { TierBarProps } from "./TierBar";
export { TimerStrip } from "./TimerStrip";
export type { TimerStripProps } from "./TimerStrip";
export { ICONS } from "./bitmaps";
export type { IconName } from "./bitmaps";
export {
  COLUMN_LOGICAL_WIDTH,
  DEFAULT_SCALE,
  PixelScaleContext,
  WIDE_ROW_CP,
  WIDE_ROW_PX,
  canvasDpFor,
  deviceToCss,
  iconPixel,
  isWide,
  noticeDevicePixelRatio,
  pixelScale,
  pixelVariables,
  tapSize,
  usePixelRootScale,
  usePixelScale,
} from "./scale";
export type { PixelScale } from "./scale";
export { OLD_DETAIL_STORAGE_KEY, forgetDetailChoice } from "./forget-detail";
export {
  SLIDE_MS,
  type Slider,
  createSlider,
  prefersReducedMotion,
  snapToDevice,
} from "./slide";
export { useArrivalFocus } from "./useArrivalFocus";
export {
  ARRIVAL_PATIENCE_MS,
  FADE_MS,
  arrivingThroughFade,
  fadeArrived,
  fadeThrough,
  useFadeArrival,
} from "./fade";
export { HEADING_FACES, fetchHeadingFaces } from "./fonts";
export { useDeviceSky } from "./useDeviceSky";
export type { DeviceSky } from "./useDeviceSky";
export { UI_GRADES } from "./types";
export type { UiGrade, UiMode } from "./types";
