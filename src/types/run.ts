export enum BuildType {
    FRONT = 'front',
    CLI = 'cli',
    BACK = 'back',  
    ALL = 'all'
}

export enum BuilderType {
    WEBPACK = 'webpack',
    VITE = 'vite'    
}

export enum ManagerRunOptions {
    BUILD = 'build',
    WATCH = 'watch',
    VERBOSE = 'verbose',
    RELOAD = 'reload'
}