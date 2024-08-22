const { defineConfig } = require('@vue/cli-service');

module.exports = defineConfig({
    publicPath: './',
    configureWebpack: {
        output: {
            filename: 'assets/js/[name].[fullhash:8].js',
            chunkFilename: 'assets/js/[name].[fullhash:8].js',
        },
    },
    chainWebpack: config => {
        if (config.plugins.has('extract-css')) {
            config.plugin('extract-css').tap(args => {
                args[0].filename = 'assets/css/[name].[fullhash:8].css';
                args[0].chunkFilename = 'assets/css/[name].[fullhash:8].css';
                return args;
            });
        }
    },
    assetsDir: 'assets',
});