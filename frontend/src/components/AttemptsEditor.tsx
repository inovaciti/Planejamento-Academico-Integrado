import {
  formatGrade,
  nearestFreeTerm,
  periodOf,
  termWithPeriod,
} from "../academicTerms";
import type { Course, HistoryRecord } from "../types";
import { failureText } from "./CourseCard";

const field =
  "attempt-field block w-full rounded-lg border border-slate-300 bg-white px-2 text-sm";
const small =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium hover:bg-slate-50";

/** Tentativas reais de uma disciplina, editadas no painel de detalhes do mapa. */
export function AttemptsEditor({
  course,
  records,
  terms,
  startTerm,
  defaultTerm,
  firstPeriodRequired,
  failureLimit,
  failureRule,
  onChange,
}: {
  course: Course;
  records: HistoryRecord[];
  terms: string[];
  /** Ingresso: dá o período de cada semestre ("2025.1 · 3º período"). */
  startTerm: string;
  defaultTerm: string;
  firstPeriodRequired: boolean;
  failureLimit: number;
  failureRule: string;
  onChange: (records: HistoryRecord[]) => void;
}) {
  const sorted = [...records].sort((a, b) =>
    a.academic_term.localeCompare(b.academic_term),
  );
  const failures = sorted.filter((r) => r.status === "failed").length;
  const approved = sorted.some((r) => r.status === "completed");
  const refused = failures >= failureLimit;
  const used = new Set(sorted.map((r) => r.academic_term));
  const free = terms.filter((t) => !used.has(t));
  const current = terms[terms.length - 1];
  // Ocupado o semestre esperado, vale o livre mais próximo — nunca o 1º por acaso.
  const preferred = nearestFreeTerm(free, defaultTerm);
  const label = (term: string) => termWithPeriod(startTerm, term);
  const canAdd = !refused && !approved && free.length > 0;

  function update(index: number, change: Partial<HistoryRecord>) {
    onChange(
      sorted.map((record, i) => {
        if (i !== index) return record;
        const next = { ...record, ...change };
        if (next.status === "in_progress") next.grade = null;
        return next;
      }),
    );
  }
  function add(status: HistoryRecord["status"]) {
    const term = status === "in_progress" ? current : preferred;
    if (!term || used.has(term)) return;
    onChange([
      ...sorted,
      { course_id: course.id, academic_term: term, status },
    ]);
  }
  /** Obrigatória cursada fora do período da matriz muda de coluna no mapa. */
  const movedTo = (term: string) => {
    if (course.type !== "mandatory" || !course.period) return null;
    const period = periodOf(startTerm, term);
    return period >= 1 && period !== course.period ? period : null;
  };

  return (
    <section
      className="attempts-editor mt-4"
      aria-label="Situação no histórico"
    >
      <h3 className="text-xs font-semibold text-slate-600">
        Situação no histórico
      </h3>
      {canAdd && (
        <div className="attempt-actions mt-2">
          <p className="text-xs text-slate-600">
            Registrar em <strong>{label(preferred ?? current)}</strong>
            {!sorted.length && " (dá para trocar o semestre depois)"}
          </p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <button
              type="button"
              className="attempt-action"
              data-kind="completed"
              onClick={() => add("completed")}
            >
              + Aprovada
            </button>
            <button
              type="button"
              className="attempt-action"
              data-kind="failed"
              onClick={() => add("failed")}
            >
              + Reprovada
            </button>
            {!used.has(current) && (
              <button
                type="button"
                className="attempt-action"
                data-kind="in_progress"
                onClick={() => add("in_progress")}
                title={`Cursando em ${label(current)}`}
              >
                + Cursando agora
              </button>
            )}
          </div>
        </div>
      )}
      {!sorted.length && (
        <p
          className={`mt-2 rounded-lg p-2.5 text-xs leading-5 ${firstPeriodRequired ? "bg-amber-50 text-amber-900" : "bg-slate-50 text-slate-600"}`}
        >
          {firstPeriodRequired
            ? "Cadeira do 1º período: as disciplinas padrão são obrigatórias. Informe se foi aprovada ou reprovada."
            : "Não cursada. Registre uma tentativa se você já pagou esta cadeira."}
        </p>
      )}
      {failures > 0 && (
        <p
          className={`mt-2 rounded-lg p-2.5 text-xs leading-5 ${failures >= 2 ? "bg-red-50 text-red-800" : "bg-amber-50 text-amber-900"}`}
        >
          <strong>{failureText(failures)}</strong>
          {refused
            ? ` · matrícula recusada nesta disciplina (${failureRule}).`
            : ` de ${failureLimit - 1} permitidas antes da recusa de matrícula na ${failureLimit}ª (${failureRule}).`}
        </p>
      )}
      <div className="mt-2 space-y-2">
        {sorted.map((record, index) => {
          const moved = movedTo(record.academic_term);
          return (
            <div
              key={record.academic_term}
              className="rounded-lg border border-slate-200 bg-white/70 p-2"
              role="group"
              aria-label={`Tentativa ${index + 1}`}
            >
              <div className="grid gap-2">
                <label className="text-[11px] text-slate-500">
                  Semestre
                  <select
                    className={field}
                    value={record.academic_term}
                    onChange={(e) =>
                      update(index, { academic_term: e.target.value })
                    }
                  >
                    {[record.academic_term, ...free].sort().map((term) => (
                      <option key={term} value={term}>
                        {label(term)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-[11px] text-slate-500">
                  Situação
                  <select
                    className={field}
                    value={record.status}
                    onChange={(e) =>
                      update(index, {
                        status: e.target.value as HistoryRecord["status"],
                      })
                    }
                  >
                    <option value="completed">Aprovada</option>
                    <option value="failed">Reprovada</option>
                    <option value="in_progress">Cursando</option>
                  </select>
                </label>
              </div>
              {moved && (
                <p className="attempt-moved mt-2 text-xs leading-5">
                  Aparece na coluna do <strong>{moved}º período</strong> no
                  mapa, fora do {course.period}º período da matriz.
                </p>
              )}
              <label className="mt-2 block text-[11px] text-slate-500">
                Nota final
                <input
                  className={field}
                  type="number"
                  min="0"
                  max="10"
                  step="0.1"
                  inputMode="decimal"
                  disabled={record.status === "in_progress"}
                  placeholder={
                    record.status === "in_progress" ? "—" : "0 a 10 (opcional)"
                  }
                  value={record.grade ?? ""}
                  onChange={(e) => {
                    const value = e.target.value.replace(",", ".");
                    const grade = value === "" ? null : Number(value);
                    if (grade === null || (grade >= 0 && grade <= 10))
                      update(index, { grade });
                  }}
                />
              </label>
              <div className="mt-2 flex flex-wrap justify-end gap-2">
                {record.status === "failed" && (
                  <button
                    type="button"
                    className={small}
                    onClick={() => update(index, { grade: 0 })}
                  >
                    Por falta (0)
                  </button>
                )}
                <button
                  type="button"
                  className={`${small} text-red-700`}
                  aria-label={`Remover tentativa de ${record.academic_term}`}
                  onClick={() => onChange(sorted.filter((_, i) => i !== index))}
                >
                  Remover
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {sorted.length > 0 && !firstPeriodRequired && (
        <button
          type="button"
          className="mt-2 text-xs text-slate-500 underline"
          onClick={() => onChange([])}
        >
          Marcar como não cursada
        </button>
      )}
      {sorted.some((r) => r.grade !== null && r.grade !== undefined) && (
        <p className="mt-2 text-[11px] text-slate-500">
          Todas as tentativas com nota entram no CR, inclusive reprovações (
          {sorted
            .filter((r) => r.grade !== null && r.grade !== undefined)
            .map((r) => formatGrade(r.grade))
            .join(" · ")}
          ).
        </p>
      )}
    </section>
  );
}
