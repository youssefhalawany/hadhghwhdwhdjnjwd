export const vibrateSuccess = () => {
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    navigator.vibrate(10);
  }
};

export const vibrateError = () => {
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    // Double sharp vibration for errors
    navigator.vibrate([50, 50, 50]);
  }
};
