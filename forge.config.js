module.exports = {
    packagerConfig: {
        asar: true,
        out: "dist",
        appBundleId: "com.github.guenhter.multi-ssh",
        productName: "Multi SSH",
        files: ["main.js", "renderer.js", "index.html", "node_modules/**/*"],
    },
    rebuildConfig: {},
    makers: [
        {
            name: "@electron-forge/maker-squirrel",
            config: {},
        },
        {
            name: "@electron-forge/maker-zip",
            platforms: ["darwin"],
        },
        {
            name: "@electron-forge/maker-deb",
            config: {},
        },
    ],
};
