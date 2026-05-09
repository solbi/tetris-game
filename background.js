const GAME_WINDOW_URL = chrome.runtime.getURL("popup.html");
const GAME_WINDOW_WIDTH = 740;
const GAME_WINDOW_HEIGHT = 700;
const GAME_WINDOW_ID_KEY = "classicTetrisGameWindowId";

let gameWindowId = null;
let correctingBounds = false;

async function readGameWindowId() {
  if (gameWindowId !== null) return gameWindowId;

  const stored = await chrome.storage.session.get(GAME_WINDOW_ID_KEY);
  const storedWindowId = stored[GAME_WINDOW_ID_KEY];
  gameWindowId = Number.isInteger(storedWindowId) ? storedWindowId : null;
  return gameWindowId;
}

async function writeGameWindowId(windowId) {
  gameWindowId = windowId;

  if (windowId === null) {
    await chrome.storage.session.remove(GAME_WINDOW_ID_KEY);
    return;
  }

  await chrome.storage.session.set({ [GAME_WINDOW_ID_KEY]: windowId });
}

async function focusExistingWindow() {
  const existingWindowId = await readGameWindowId();
  if (existingWindowId === null) return false;

  try {
    const gameWindow = await chrome.windows.get(existingWindowId);
    await correctGameWindowSize(gameWindow);
    await chrome.windows.update(existingWindowId, { focused: true });
    return true;
  } catch {
    await writeGameWindowId(null);
    return false;
  }
}

function hasNumericBounds(windowInfo) {
  return (
    Number.isFinite(windowInfo?.left) &&
    Number.isFinite(windowInfo?.top) &&
    Number.isFinite(windowInfo?.width) &&
    Number.isFinite(windowInfo?.height)
  );
}

function getCenteredBounds(anchorWindow) {
  if (!hasNumericBounds(anchorWindow)) {
    return {};
  }

  return {
    left: Math.round(anchorWindow.left + Math.max(0, anchorWindow.width - GAME_WINDOW_WIDTH) / 2),
    top: Math.round(anchorWindow.top + Math.max(0, anchorWindow.height - GAME_WINDOW_HEIGHT) / 2),
  };
}

async function getAnchorWindow(sourceTab) {
  if (sourceTab?.windowId !== undefined) {
    try {
      return await chrome.windows.get(sourceTab.windowId);
    } catch {
      // Fall through to the last-focused window.
    }
  }

  try {
    return await chrome.windows.getLastFocused({ windowTypes: ["normal", "popup"] });
  } catch {
    return null;
  }
}

function needsSizeCorrection(windowInfo) {
  return windowInfo?.width !== GAME_WINDOW_WIDTH || windowInfo?.height !== GAME_WINDOW_HEIGHT;
}

async function correctGameWindowSize(windowInfo) {
  const existingWindowId = await readGameWindowId();

  if (
    correctingBounds ||
    existingWindowId === null ||
    windowInfo?.id !== existingWindowId ||
    !needsSizeCorrection(windowInfo)
  ) {
    return;
  }

  correctingBounds = true;
  try {
    await chrome.windows.update(existingWindowId, {
      width: GAME_WINDOW_WIDTH,
      height: GAME_WINDOW_HEIGHT,
    });
  } finally {
    correctingBounds = false;
  }
}

async function openGameWindow(sourceTab) {
  if (await focusExistingWindow()) return;

  const anchorWindow = await getAnchorWindow(sourceTab);
  const gameWindow = await chrome.windows.create({
    url: GAME_WINDOW_URL,
    type: "popup",
    width: GAME_WINDOW_WIDTH,
    height: GAME_WINDOW_HEIGHT,
    ...getCenteredBounds(anchorWindow),
    focused: true,
  });

  await writeGameWindowId(gameWindow?.id ?? null);
}

chrome.action.onClicked.addListener((tab) => {
  openGameWindow(tab).catch(console.error);
});

chrome.windows.onRemoved.addListener((windowId) => {
  readGameWindowId()
    .then((existingWindowId) => {
      if (windowId === existingWindowId) {
        return writeGameWindowId(null);
      }
      return undefined;
    })
    .catch(console.error);
});

chrome.windows.onBoundsChanged.addListener((windowInfo) => {
  correctGameWindowSize(windowInfo).catch(console.error);
});
