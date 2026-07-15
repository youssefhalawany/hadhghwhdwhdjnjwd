export const hapticLight = () => {
  if (typeof window !== "undefined" && navigator.vibrate) {
    navigator.vibrate([15]);
  }
};

export const hapticMedium = () => {
  if (typeof window !== "undefined" && navigator.vibrate) {
    navigator.vibrate([30]);
  }
};

export const vibrateSuccess = () => {
  if (typeof window !== "undefined" && navigator.vibrate) {
    navigator.vibrate([30, 50, 30]);
  }
};

export const vibrateError = () => {
  if (typeof window !== "undefined" && navigator.vibrate) {
    navigator.vibrate([50, 50, 50, 50, 50]);
  }
};
