// build-nodrpc.js
module.exports = {
    appId: "jvbf.ynodesktop.nodrpc",
    productName: "YNOdesktop-NoDRPC",
    directories: {
      output: "dist-nodrpc",
      buildResources: "assets"
    },
    win: {
      target: [
        "portable",
        "zip",
        "nsis",
        "appx"
      ]
    },
    icon: "assets/logo.ico",
    nsis: {
      oneClick: false,
      allowToChangeInstallationDirectory: true,
      installerIcon: "assets/logo.ico"
    },
    appx: {
      identityName: "51567jvbf.YNOdesktop.NoDRPC",
      publisher: "CN=6D79C59E-C608-4AA1-A818-EEFB5F3B76DF",
      publisherDisplayName: "jvbf",
      applicationId: "jvbf.ynodesktop.nodrpc"
    }
  };
  