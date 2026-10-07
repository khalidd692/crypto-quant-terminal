export interface ExperimentRecord {
  readonly experimentId: string;
  readonly hypothesis: string;
  readonly datasetVersion: string;
  readonly featureVersions: readonly string[];
  readonly modelVersion: string | null;
  readonly evaluationWindow: { readonly start: string; readonly end: string };
  readonly metrics: Readonly<Record<string, number>>;
  readonly selected: boolean;
  readonly notes: string;
}

export class ExperimentRegistry {
  private readonly records = new Map<string, ExperimentRecord>();

  public register(record: ExperimentRecord): void {
    if (this.records.has(record.experimentId)) throw new Error(`Experiment already exists: ${record.experimentId}`);
    if (!record.hypothesis.trim()) throw new Error("Experiment hypothesis is required");
    this.records.set(record.experimentId, record);
  }

  public get(experimentId: string): ExperimentRecord | undefined {
    return this.records.get(experimentId);
  }

  public all(): readonly ExperimentRecord[] {
    return [...this.records.values()];
  }
}
