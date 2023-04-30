const { app, BrowserWindow, session, ipcMain, dialog } = require("electron");
const contextMenu = require("electron-context-menu");
const DiscordRPC = require("discord-rpc");
const Store = require("electron-store");
const promptInjection = require("./promptinjection");
const titlebar = require("./titlebar");
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
  ],
});

const client = new DiscordRPC.Client({ transport: "ipc" });
client.login({ clientId: "1028080411772977212" }).catch(console.error);

const mappedIcons = [
  "amillusion",
  "answeredprayers",
  "braingirl",
  "deepdreams",
  "flow",
  "someday",
  "unevendream",
  "yno-logo",
  "yume2kki",
  "yumenikki",
  "mumarope",
  "genie",
  "mikan",
  "2kki",
  "yume",
  "prayers",
  "muma",
  "dreamgenie",
  "mikanmuzou"
];

const createWindow = () => {
  const win = new BrowserWindow({
    width: 1052,
    height: 768 + 30, // 30px for titlebar
    title: "Yume Nikki Online Project",
    icon: "logo.png",
    resizable: false,
    frame: true,
    titleBarStyle: "hidden",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });
  var loopInterval = null;
  win.setMenu(null);
  win.setTitle("Yume Nikki Online Project");

  win.on("close", () => {
    saveSession();
    client.clearActivity();
    clearInterval(loopInterval);
    client.destroy();
    win.destroy();
  });

  win.webContents.on("did-finish-load", () => {
    promptInjection(win); // Custom prompt hack
    win.webContents
      .executeJavaScript(`if (document.title != "Yume Nikki Online Project") {
      document.getElementById('content').style.overflow = 'hidden'
      document.querySelector('#content')?.scrollTo(0,0)}`); // Disable scroll ingame
  });

  win.webContents.on("did-start-loading", () => {
    titlebar(win); // Custom titlebar hack
  });

  win.loadURL("https://ynoproject.net/").then(() => {
    loopInterval = setInterval(() => {
      clientLoop(win);
      //win.webContents.openDevTools();
    }, 1000);
  });
};

app.whenReady().then(() => {
  // Load login session from disk
  if (store.get("sessionId")) {
    session.defaultSession.cookies.set({
      url: "https://ynoproject.net",
      name: "sessionId",
      value: store.get("sessionId"),
      sameSite: "strict",
    });
  }
  ipcMain.on("minimize", () => {
    BrowserWindow.getFocusedWindow().minimize();
  });
  createWindow();
});

function clientLoop(win) {
  const web = win.webContents;
  web.executeJavaScript(`document.title`).then((title) => {
    let splitTitle = title.split(" - ");
    if (splitTitle[1]?.trim() == "YNOproject") {
      if (splitTitle[0].trim() == "ゆめ2っき") {
        updatePresence(web, 'Yume 2kki');
      } else {
        updatePresence(web, splitTitle[0].trim());
      }
    } else {
      updatePresence(web);
    }
  });
}

function isConnected(text) {
  return text === "Connected" || text === "接続済み" || text === "已连接" || text === "연결됨" || text === "Conectado" || text === "Connecté(e)" || text === "Verbunden" || text === "Connesso" || text === "В сети" || text === "Đã kết nối" || text === "متصل";
}

function getLocationFromList(nodeList) {
  return nodeList.item((nodeList.length == 1) ? 0 : 1)?.textContent;
}

function updatePresence(web, gamename = null) {
  if (!client) return;
  web.executeJavaScript("window.onbeforeunload=null;");

  if (gamename == null) {
    client.setActivity({
      largeImageKey: "yno-logo",
      largeImageText: "Yume Nikki Online Project",
      details: "Choosing a game...",
      instance: false,
    });
  } else {
    web
      .executeJavaScript(
        `
        (function() {
          return {
            name: window.location.pathname.replaceAll('/', ''),
            locationList: document.querySelector("#locationText")?.querySelectorAll("a"),
            connected: document.querySelector("#connStatusText")?.textContent
          }
        })()
      `
      )
      .then((data) => {
        const condensedName = gamename
          .toLowerCase()
          .replace(" ", "")
          .replace(".", "");
        client.setActivity({
          largeImageKey: mappedIcons.includes(condensedName)
            ? condensedName + "-icon"
            : `https://ynoproject.net/images/door_${data.name}.gif`,
          largeImageText: gamename,
          smallImageKey: "yno-logo",
          smallImageText: "Yume Nikki Online Project",
          details: "Dreaming on " + gamename,
          state: isConnected(data.connected) ? getLocationFromList(data.locationList) : undefined,
          instance: false,
        });
      });
  }
}

function saveSession() {
  session.defaultSession.cookies
    .get({ url: "https://ynoproject.net" })
    .then((cookies) => {
      const sess = cookies.find((cookie) => cookie.name == "sessionId");
      if (sess) store.set("sessionId", sess.value);
    });
}
