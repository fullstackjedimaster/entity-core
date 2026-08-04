"use client";

import { useMemo, useState } from "react";

import EmbedHeightReporter from "@/components/EmbedHeightReporter";

type JsonRecord = Record<string, unknown>;
type FieldKind = "text" | "number" | "boolean" | "date" | "json";

type FieldDefinition = {
  name: string;
  label: string;
  kind: FieldKind;
  initialValue: unknown;
};

type ParsedEntity = {
  name: string;
  fields: FieldDefinition[];
};

const EXAMPLE_JSON = JSON.stringify(
  {
    customer: {
      first_name: "Ada",
      last_name: "Lovelace",
      email: "ada@example.com",
      account_number: 1001,
      active: true,
      start_date: "2026-08-04",
    },
  },
  null,
  2,
);

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function titleCase(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function inferKind(value: unknown, fieldName: string): FieldKind {
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return "number";
  if (Array.isArray(value) || isRecord(value)) return "json";
  if (/date|_at$|timestamp/i.test(fieldName)) return "date";
  return "text";
}

function parseEntity(source: string): ParsedEntity {
  let parsed: unknown;

  try {
    parsed = JSON.parse(source);
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `Invalid JSON: ${error.message}`
        : "Invalid JSON.",
    );
  }

  if (!isRecord(parsed)) {
    throw new Error("The JSON root must be an object containing one entity object.");
  }

  const entries = Object.entries(parsed);
  if (entries.length !== 1) {
    throw new Error("Provide exactly one top-level entity object.");
  }

  const [name, value] = entries[0];
  if (!name.trim()) throw new Error("The entity name cannot be empty.");
  if (!isRecord(value)) {
    throw new Error(`The top-level \"${name}\" value must be an object.`);
  }

  const fields = Object.entries(value).map(([fieldName, initialValue]) => ({
    name: fieldName,
    label: titleCase(fieldName),
    kind: inferKind(initialValue, fieldName),
    initialValue,
  }));

  if (fields.length === 0) {
    throw new Error("The entity must include at least one field.");
  }

  return { name, fields };
}

function defaultInputValue(field: FieldDefinition): string | number {
  if (field.kind === "number") {
    return typeof field.initialValue === "number" ? field.initialValue : 0;
  }
  if (field.kind === "json") {
    return JSON.stringify(field.initialValue, null, 2);
  }
  return typeof field.initialValue === "string" ? field.initialValue : "";
}

export default function EntityCoreDemoPage() {
  const [source, setSource] = useState(EXAMPLE_JSON);
  const [entity, setEntity] = useState<ParsedEntity | null>(null);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [error, setError] = useState("");
  const [activeView, setActiveView] = useState<"form" | "workflow">("form");

  const status = error ? "Error" : entity ? "Workspace ready" : "Ready";
  const statusClass = error ? "error" : entity ? "ready" : "";

  const payload = useMemo(() => {
    if (!entity) return null;
    return { [entity.name]: values };
  }, [entity, values]);

  function renderWorkspace() {
    try {
      const parsed = parseEntity(source);
      const initialValues = Object.fromEntries(
        parsed.fields.map((field) => [field.name, field.initialValue]),
      );
      setEntity(parsed);
      setValues(initialValues);
      setError("");
      setActiveView("form");
    } catch (caught) {
      setEntity(null);
      setValues({});
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }

  function resetExample() {
    setSource(EXAMPLE_JSON);
    setEntity(null);
    setValues({});
    setError("");
    setActiveView("form");
  }

  function updateValue(field: FieldDefinition, nextValue: unknown) {
    setValues((current) => ({ ...current, [field.name]: nextValue }));
  }

  return (
    <main className="demo-page" id="entity-core-embed-content">
      <EmbedHeightReporter contentRootId="entity-core-embed-content" />

      <div className="demo-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Schema-driven workspace</p>
              <h1>Entity Definition</h1>
              <p>
                Enter one entity object, then build its dynamic form and CRUD workflow.
              </p>
            </div>
            <span className={`status-pill ${statusClass}`}>{status}</span>
          </div>

          <div className="form-stack">
            <label className="form-field">
              <span>Entity JSON</span>
              <textarea
                value={source}
                onChange={(event) => {
                  setSource(event.target.value);
                  setEntity(null);
                  setValues({});
                  setError("");
                }}
                spellCheck={false}
                aria-label="Entity JSON"
              />
            </label>

            {error ? <div className="error-box">{error}</div> : null}

            <div className="actions">
              <button className="button button-primary" type="button" onClick={renderWorkspace}>
                Build Workspace
              </button>
              <button className="button button-secondary" type="button" onClick={resetExample}>
                Reset Example
              </button>
            </div>
          </div>
        </section>

        <section className="panel workspace-panel">
          <div className="panel-heading workspace-heading">
            <div>
              <p className="eyebrow">Generated application</p>
              <h2>{entity ? titleCase(entity.name) : "Entity Workspace"}</h2>
              <p>
                Preview the generated form and the REST workflow Entity Core coordinates.
              </p>
            </div>
          </div>

          {entity ? (
            <>
              <div className="view-tabs" role="tablist" aria-label="Workspace views">
                <button
                  className={activeView === "form" ? "view-tab active" : "view-tab"}
                  type="button"
                  onClick={() => setActiveView("form")}
                >
                  Dynamic Form
                </button>
                <button
                  className={activeView === "workflow" ? "view-tab active" : "view-tab"}
                  type="button"
                  onClick={() => setActiveView("workflow")}
                >
                  CRUD Workflow
                </button>
              </div>

              {activeView === "form" ? (
                <div className="generated-form">
                  {entity.fields.map((field) => (
                    <label className="form-field" key={field.name}>
                      <span>{field.label}</span>
                      {field.kind === "boolean" ? (
                        <span className="checkbox-row">
                          <input
                            type="checkbox"
                            checked={Boolean(values[field.name])}
                            onChange={(event) => updateValue(field, event.target.checked)}
                          />
                          <span>Enabled</span>
                        </span>
                      ) : field.kind === "json" ? (
                        <textarea
                          className="compact-json"
                          value={String(values[field.name] ?? defaultInputValue(field))}
                          onChange={(event) => updateValue(field, event.target.value)}
                        />
                      ) : (
                        <input
                          type={field.kind === "number" ? "number" : field.kind === "date" ? "date" : "text"}
                          value={String(values[field.name] ?? defaultInputValue(field))}
                          onChange={(event) =>
                            updateValue(
                              field,
                              field.kind === "number"
                                ? Number(event.target.value)
                                : event.target.value,
                            )
                          }
                        />
                      )}
                    </label>
                  ))}

                  <div className="payload-preview">
                    <span>Submission payload</span>
                    <pre>{JSON.stringify(payload, null, 2)}</pre>
                  </div>
                </div>
              ) : (
                <div className="workflow-list">
                  {[
                    ["Define", "Store entity JSON and normalize field metadata."],
                    ["Render", "Generate the React form from the entity definition."],
                    ["Create", `POST a new ${entity.name} record through the API.`],
                    ["Read", `Fetch individual or paginated ${entity.name} records.`],
                    ["Update", "Validate edits and persist only allowed fields."],
                    ["Delete", "Remove a record through the secured REST endpoint."],
                  ].map(([label, description], index) => (
                    <div className="workflow-step" key={label}>
                      <span className="workflow-index">{index + 1}</span>
                      <div>
                        <strong>{label}</strong>
                        <p>{description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="empty-state">
              <div>
                <strong>No workspace generated.</strong>
                Enter valid entity JSON and click <b>Build Workspace</b>.
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
