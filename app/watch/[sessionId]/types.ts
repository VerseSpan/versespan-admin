export interface I18NStrings {
  sessionEnded: string;
  thankYouJoining: string;
  shareFeedback: string;
  skip: string;
  formTitle: string;
  overall: string;
  translation: string;
  audio: string;
  audioDelay: string;
  audioDelayLabels: string[];
  hadBugs: string;
  yes: string;
  no: string;
  bugDescription: string;
  bugDescriptionPlaceholder: string;
  comment: string;
  commentPlaceholder: string;
  submit: string;
  back: string;
  thankYou: string;
  thankYouSub: string;
  tapToEnable: string;
  tapToEnableSub: string;
  live: string;
  connecting: string;
  reconnecting: string;
  audioOn: string;
  audioOff: string;
  nowPlaying: string;
  liveTranslation: string;
  connectingStream: string;
  scripture: string;
  labelSpeech: string;
  labelSong: string;
  labelScripture: string;
}

export type FeedbackState = "idle" | "form" | "submitted";

export interface FormValues {
  ratingOverall: number;
  ratingTranslation: number;
  ratingAudio: number;
  ratingAudioDelay: number;
  hadBugs: boolean | null;
  bugDescription: string;
  comment: string;
}
