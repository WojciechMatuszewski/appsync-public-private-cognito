import { path } from "app-root-path";
import { join } from "path";

function getFunctionPath(pathFromFunctionsDir: string) {
  return join(path, `dist/functions/${pathFromFunctionsDir}`);
}

function pathFromRoot(pathToJoin: string) {
  return join(path, pathToJoin);
}

export { getFunctionPath, pathFromRoot };
