"background only";

import type {
  ActivityResult,
  AudioLevelResult,
  BatteryStatusResult,
  ChangeSummary,
  LocationResult,
  PermissionSnapshot,
  PermissionState,
  SensingCapability,
  SensingNativeModule,
  SensingResult,
  TimeRange,
  UsageStatsResult,
  WellbeingRiskResult,
} from "./sensing-contract";

type NativeModulesContainer = {
  Sensing?: SensingNativeModule;
};

type GlobalWithNativeModules = {
  NativeModules?: NativeModulesContainer;
  lynx?: {
    getJSModule?: <T = unknown>(name: string) => T;
  };
};

function getNativeSensingModule(): SensingNativeModule | null {
  const globalObject = globalThis as GlobalWithNativeModules;
  const fromGlobal = globalObject.NativeModules?.Sensing;
  if (fromGlobal) {
    return fromGlobal;
  }

  const moduleGetter = globalObject.lynx?.getJSModule;
  if (!moduleGetter) {
    return null;
  }

  try {
    const modules = moduleGetter<NativeModulesContainer>("NativeModules");
    return modules?.Sensing ?? null;
  } catch {
    return null;
  }
}

function unavailableError<T>(): SensingResult<T> {
  return {
    ok: false,
    code: "UNAVAILABLE",
    error: "Native Sensing module is not registered by the host app.",
  };
}

function normalizeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return typeof error === "string" ? error : "Unknown native error";
}

async function callNative<T>(
  invoke: (module: SensingNativeModule) => Promise<T> | undefined
): Promise<SensingResult<T>> {
  const module = getNativeSensingModule();
  if (!module) {
    return unavailableError<T>();
  }

  try {
    const value = await invoke(module);
    if (typeof value === "undefined") {
      return {
        ok: false,
        code: "UNSUPPORTED",
        error: "Capability is not supported on this platform.",
      };
    }
    return { ok: true, data: value };
  } catch (error) {
    const message = normalizeErrorMessage(error);
    const isPermissionError = /permission|denied|unauthorized|forbidden/i.test(message);
    return {
      ok: false,
      code: isPermissionError ? "PERMISSION_DENIED" : "NATIVE_ERROR",
      error: message,
    };
  }
}

export async function requestPermission(
  capability: SensingCapability
): Promise<SensingResult<PermissionState>> {
  return callNative((module) => module.requestPermission?.(capability));
}

export async function getPermissionStatus(
  capability: SensingCapability
): Promise<SensingResult<PermissionState>> {
  return callNative((module) => module.getPermissionStatus?.(capability));
}

export async function getActivity(): Promise<SensingResult<ActivityResult>> {
  return callNative((module) => module.getActivity?.());
}

export async function getLocation(): Promise<SensingResult<LocationResult>> {
  return callNative((module) => module.getLocation?.());
}

export async function getUsageStats(windowMs = 60 * 60 * 1000): Promise<SensingResult<UsageStatsResult | null>> {
  return callNative((module) => module.getUsageStats?.(windowMs));
}

export async function getBatteryStatus(): Promise<SensingResult<BatteryStatusResult>> {
  return callNative((module) => module.getBatteryStatus?.());
}

export async function getAudioLevel(): Promise<SensingResult<AudioLevelResult>> {
  return callNative((module) => module.getAudioLevel?.());
}

export async function startAudioLevelStream(intervalMs = 500): Promise<SensingResult<null>> {
  const result = await callNative(async (module) => {
    await module.startAudioLevelStream?.(intervalMs);
    return null;
  });
  return result;
}

export async function stopAudioLevelStream(): Promise<SensingResult<null>> {
  const result = await callNative(async (module) => {
    await module.stopAudioLevelStream?.();
    return null;
  });
  return result;
}

export async function captureAndPersistSnapshot(): Promise<SensingResult<PermissionSnapshot>> {
  return callNative((module) => module.captureAndPersistSnapshot?.());
}

export async function getPermissionHistory(
  capability: SensingCapability,
  range?: TimeRange
): Promise<SensingResult<PermissionSnapshot[]>> {
  return callNative((module) => module.getPermissionHistory?.(capability, range));
}

export async function getChangeSummary(range?: TimeRange): Promise<SensingResult<ChangeSummary>> {
  return callNative((module) => module.getChangeSummary?.(range));
}

export async function getWellbeingRisk(range?: TimeRange): Promise<SensingResult<WellbeingRiskResult>> {
  return callNative((module) => module.getWellbeingRisk?.(range));
}
