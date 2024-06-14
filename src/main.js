const {
  app,
  BrowserWindow,
  session,
  ipcMain,
  dialog,
  shell,
} = require("electron");
const contextMenu = require("electron-context-menu");
const DiscordRPC = require("discord-rpc");
const Store = require("electron-store");
const promptInjection = require("./scripts/promptinjection");
const titlebar = require("./scripts/titlebar");
const { updatePresence } = require("./scripts/discordRpcUtils");
const path = require("path");

const store = new Store();

contextMenu({
  showSelectAll: false,
  showSearchWithGoogle: false,
  showInspectElement: false,
  append: (defaultActions, params, browserWindow) => [
    {
      label: "Force Reload",
      click: () => {
        browserWindow.webContents.reloadIgnoringCache();
      },
    },
    {
      label: "Clear IndexedDB",
      click: () => {
        dialog
          .showMessageBox({
            type: "question",
            buttons: ["Yes", "No"],
            title: "Clear IndexedDB",
            message:
              "Are you sure you want to clear IndexedDB? This should only be used if something is broken as it will delete your local save file.\nThis will also clear the cache and Local Storage.",
          })
          .then((result) => {
            if (result.response == 0) {
              dialog
                .showMessageBox({
                  type: "warning",
                  buttons: ["Yes", "No"],
                  title: "Clear IndexedDB",
                  message:
                    "ATTENTION: THIS WILL DELETE YOUR LOCAL SAVE FILE.\nAre you sure you want to continue?",
                })
                .then((result) => {
                  if (result.response == 0) {
                    session.defaultSession
                      .clearStorageData({
                        storages: ["indexdb", "cache", "localstorage"],
                      })
                      .then(() => {
                        browserWindow.webContents.reloadIgnoringCache();
                      });
                  }
                });
            }
          });
      },
    },
    {
      label: "Open Developer Tools",
      click: () => {
        browserWindow.webContents.openDevTools();
      },
    },
    {
      label: "Zoom In",
      click: () => {
        browserWindow.webContents.send("zoomin");
      },
    },
    {
      label: "Zoom Out",
      click: () => {
        browserWindow.webContents.send("zoomout");
      },
    },
  ],
});

let client = new DiscordRPC.Client({ transport: "ipc" });
client.login({ clientId: "1028080411772977212" }).catch(console.error);

const createWindow = () => {
  const win = new BrowserWindow({
    width: 1052,
    height: 798, // 30px for titlebar
    title: "Yume Nikki Online Project",
    icon: "assets/logo.png",
    resizable: true,
    frame: true,
    titleBarStyle: "hidden",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      backgroundThrottling: false,
    },
  });

  win.setMenu(null);
  win.setTitle("Yume Nikki Online Project");

  win.webContents.setMaxListeners(20);

  win.on("closed", () => {
    saveSession();
    client.clearActivity();
    client.destroy();
    win.destroy();
  });

  win.webContents.on("did-finish-load", () => {
    promptInjection(win); // Custom prompt hack
    win.webContents.executeJavaScript(`
      if (document.title != "Yume Nikki Online Project") {
        document.getElementById('content').style.overflow = 'hidden';
        document.querySelector('#content')?.scrollTo(0,0);
      }
    `); // Disable scroll ingame
  });

  win.webContents.on("devtools-opened", () => {
    win.webContents.send("log-app-version", app.getVersion());
  });

  win.webContents.setWindowOpenHandler((details) => {
    const url = details.url.toLowerCase();
    const imageExtensions = [".png", ".jpg", ".jpeg"];

    if (url.startsWith("https://yume.wiki")) {
      const isImage = imageExtensions.some((ext) => url.endsWith(ext));

      if (!isImage) {
        shell.openExternal(details.url); // Open URL in user's browser.
        return { action: "deny" }; // Prevent the app from opening the URL.
      }
    }
    return { action: "allow" };
  });

  win.webContents.on("did-start-loading", () => {
    titlebar(win); // Custom titlebar hack
  });

  win.loadURL("https://ynoproject.net/").then(() => {
    clientLoop(win);
  });
};

let isMax = false;

app.whenReady().then(() => {
  if (store.has("ynoproject_sessionId")) {
    session.defaultSession.cookies.set({
      url: "https://ynoproject.net",
      name: "ynoproject_sessionId",
      value: store.get("ynoproject_sessionId"),
      sameSite: "strict",
    });
  }
  ipcMain.on("minimize", () => {
    const focusedWindow = BrowserWindow.getFocusedWindow();
    if (focusedWindow) {
      focusedWindow.minimize();
    }
  });
  ipcMain.on("maximize", () => {
    const focusedWindow = BrowserWindow.getFocusedWindow();
    if (focusedWindow) {
      if (isMax) {
        focusedWindow.unmaximize();
      } else {
        focusedWindow.maximize();
      }
      isMax = !isMax;
    }
  });
  createWindow();
});

function clientLoop(win) {
  const loop = () => {
    const web = win.webContents;
    web.executeJavaScript(`document.title`).then((title) => {
      const splitTitle = title.split(" Online ");
      if (splitTitle[1]?.trim() === "- YNOproject") {
        if (splitTitle[0].trim() === "ゆめ2っき") {
          updatePresence(web, client, "Yume 2kki");
        } else {
          updatePresence(web, client, splitTitle[0].trim());
        }
      } else {
        updatePresence(web, client);
      }
    });

    setTimeout(loop, 1500); // Add a 1000ms sleep interval (1 second)
  };

  loop();
}

function saveSession() {
  session.defaultSession.cookies
    .get({ url: "https://ynoproject.net" })
    .then((cookies) => {
      const sess = cookies.find(
        (cookie) => cookie.name === "ynoproject_sessionId"
      );
      if (sess) store.set("ynoproject_sessionId", sess.value);
    });
}
