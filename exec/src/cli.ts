import 'reflect-metadata';

import chalk from 'chalk';
import { getCommandContext } from './_args';
import commands from './commands';
import { RWSManager } from '../../src/managers/RWSManager';
import { BuildType } from '../../src/types/run';
import { GenerateType } from '@/src/types/generate';

enum RWSManagerActions {
  BUILD = 'build',
  RUN = 'run',
  GENERATE = 'generate',
  CLI = 'cli'
}

async function main(): Promise<void>
{  
  
  const { primaryCommand, secondaryCommand, commandParams, commandOptions, isAfterRebuild } = getCommandContext(commands);

  const manager = await RWSManager.start(commandParams, commandOptions);

  switch(primaryCommand){
    case RWSManagerActions.BUILD: return await manager.build(secondaryCommand as BuildType);
    case RWSManagerActions.RUN: return await manager.run(secondaryCommand as BuildType);
    case RWSManagerActions.GENERATE: return await manager.generate(secondaryCommand as GenerateType);
    case RWSManagerActions.CLI: return await manager.run(BuildType.CLI);
  }

}

console.log(chalk.bgGreen('[RWS MANAGER] Starting systems...'));

main();
