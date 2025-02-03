import { RWSBuilder } from './_builder';
import path from 'path';
import type { Configuration as WebpackConfig } from 'webpack';
import webpack from 'webpack';
import fs from 'fs';
import { BuildersConfigurations, IBackendConfig, ICLIConfig, IFrontendConfig, IWebpackRWSConfig, RunnableConfig } from '../types/manager';
import { BuildType } from '../types/run';
import { TSConfigHelper } from '../helper/TSConfigHelper';
import { TSConfigContent } from '../types/tsc';
import { ChildProcess, spawn } from 'child_process';


export class RWSWebpackBuilder extends RWSBuilder<WebpackConfig> {
    private serverProcess: ChildProcess | null = null;

    async build(watch: boolean = false): Promise<void> {              
        const workspaceSection = this.config.get().build[this.buildType] as RunnableConfig;
        const buildersConfig: BuildersConfigurations | undefined = workspaceSection ? workspaceSection?._builders : undefined;
        const configBuildSection = buildersConfig ? buildersConfig[this.TYPE as keyof BuildersConfigurations] as IWebpackRWSConfig : null
        const buildCfg =  configBuildSection && configBuildSection.config ? configBuildSection.config  : null;

        if(!buildCfg){

            const webpackCmdParams: string [] = [];

            if(this.isVerbose()){
                // webpackCmdParams.push('--verbose');
            }
            
            this.log(`Building...`);  

            const {  
                workDir,
                workspaceCfg,
                cfg,
                rwsBuilder,
                pkgPath
            } = await this.getBuildData();

            const tsConfig: TSConfigContent = TSConfigHelper.create<TSConfigHelper>().build(                
                this.appRootPath,
                pkgPath,
                this.config,
                this.buildType
            );            

            const buildCfg: WebpackConfig = await rwsBuilder(this.appRootPath, {      
              dev: cfg.dev || false,
              entrypoint: workspaceCfg.entrypoint || './src/index.ts',
              executionDir: workDir,
              outputDir:  workspaceCfg?.outputDir || './build',
              outputFileName: workspaceCfg?.outputFileName || `${this.buildType.toLowerCase()}.rws.js`,
              tsConfig,
              publicDir:  workspaceCfg?.publicDir,                               
             
              //front
              parted: workspaceCfg?.parted,
              partedDirUrlPrefix: workspaceCfg?.partedDirUrlPrefix,    
              copyAssets: workspaceCfg?.copyAssets,
              env: workspaceCfg?.env,     

              //front debug
              hotReload: workspaceCfg?.hotReload,
              pkgReport: workspaceCfg?.pkgReport,         
            }, path.resolve(this.appRootPath, 'node_modules', pkgPath));

     
            await this.execute(buildCfg, watch);

            this.log(`Build complete.`);
        }else{
           
        }
    }

    async getBuildData() {
        type WorkspaceBuildParams = Omit<IFrontendConfig & IBackendConfig & ICLIConfig, 'workspaceDir'> & { dev: boolean, tsConfig: TSConfigContent; };
        type RWSBuilderType = ((appRoot: string, buildParams: WorkspaceBuildParams, workspaceDir: string) => Promise<WebpackConfig>) | undefined;

        let rwsBuilder: RWSBuilderType;
        let pkgPath: string = '';

        switch(this.buildType){
            //@ts-ignore
            case BuildType.FRONT: rwsBuilder = ((await import('@rws-framework/client/builder/webpack/rws.webpack.config.js')).default) as any; pkgPath = '@rws-framework/client'; break;
            //@ts-ignore
            case BuildType.BACK: rwsBuilder = ((await import('@rws-framework/server/rws.webpack.config.js')).default) as any; pkgPath = '@rws-framework/server'; break;
            //@ts-ignore
            case BuildType.CLI: rwsBuilder = ((await import('@rws-framework/server/cli.rws.webpack.config.js')).default) as any; pkgPath = '@rws-framework/server'; break;
        }            

        if(!rwsBuilder || pkgPath === ''){
            throw new Error(`Builder couldn't find webpack loader from ${this.buildType}`);
        }


        const cfg = this.config.get();
        const workspaceCfg: IFrontendConfig & IBackendConfig & ICLIConfig | undefined = cfg.build[this.buildType];

        if(!workspaceCfg){
            throw new Error('[RWS] Workspace config error.');
        }

        const workDir = path.resolve(this.appRootPath, workspaceCfg.workspaceDir);

        return {
            workDir,
            workspaceCfg,
            cfg,
            rwsBuilder,
            pkgPath
        }
    }

    private async restartServer(): Promise<void> {
        if (this.serverProcess) {
            this.serverProcess.kill();
            this.serverProcess = null;
        }

        const outputPath = this.config.getOutputFilePath(
            this.appRootPath,
            this.buildType as Exclude<BuildType, BuildType.ALL>
        );

        this.serverProcess = spawn('node', [outputPath], {
            stdio: 'inherit',
            cwd: this.workspacePath
        });

        this.serverProcess.on('error', (err) => {
            console.error('Failed to start server:', err);
        });
    }

    async execute(buildCfg: WebpackConfig, watch: boolean = false): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const compiler = webpack(buildCfg);

            if (watch) {
                let isFirstRun = true;
                compiler.watch({}, async (err, stats) => {
                    if (err) {
                        console.error(err);
                        return;
                    }

                    if (stats?.hasErrors()) {
                        console.error(stats.toString({ colors: true }));
                        return;
                    }

                    console.log(stats?.toString({ colors: true }));

                    try {
                        await this.restartServer();
                        if (isFirstRun) {
                            isFirstRun = false;
                            resolve();
                        }
                    } catch (error) {
                        console.error('Error restarting server:', error);
                    }
                });
            } else {
                compiler.run((err, stats) => {
                    if (err) {
                        reject(err);
                        console.error(err);
                        return;
                    }

                    compiler.close((cerr) => {
                        if (cerr) {
                            reject(cerr);
                            console.error(cerr);
                            return;
                        }
                        resolve();
                    });
                });
            }
        });
    }
}