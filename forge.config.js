module.exports = {
    packagerConfig: {
        asar: false, // Disable asar to allow native modules to work
        out: "dist",
        appBundleId: "com.github.guenhter.multi-ssh",
        productName: "Multi SSH",
        files: ["main.js", "renderer.js", "index.html", "node_modules/**/*"],
        extraResource: [
            "multi_ssh_config.sample.yaml"
        ],
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
