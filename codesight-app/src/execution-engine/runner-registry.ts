import { CppRunner } from "@/src/execution-engine/cpp-runner";
import { IRunner } from "@/src/execution-engine/runner-interface";
import { PythonRunner } from "@/src/execution-engine/python-runner";
import { SupportedLanguage } from "@/src/types/execution";

const runners: Partial<Record<SupportedLanguage, IRunner>> = {};

export function getRunner(language: SupportedLanguage): IRunner {
  if (!runners[language]) {
    runners[language] = language === "python" ? new PythonRunner() : new CppRunner();
  }

  return runners[language];
}
