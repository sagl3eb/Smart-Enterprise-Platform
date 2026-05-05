import { useState, useEffect, useCallback } from "react";
import PageWrapper from "../../components/layout/PageWrapper";
import { Card, CardHeader, CardBody, Badge, LoadingSpinner, EmptyState } from "../../components/ui/Card";
import { Modal, FormInput, FormSelect, FormTextarea, Button, Toast } from "../../components/ui/Modal";
import { BarChartWidget } from "../../components/charts/Charts";
import { ClipboardList, Plus, Eye, Send, Trash2 } from "lucide-react";
import { formatDate } from "../../utils/formatters";
import api from "../../api/client";
import type { Survey } from "../../types";

const emptyQuestion = { questionText: "", type: "rating", options: "", isRequired: true };

export default function Surveys() {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [showRespond, setShowRespond] = useState(false);
  const [selectedSurvey, setSelectedSurvey] = useState<Survey | null>(null);
  const [results, setResults] = useState<{ title: string; totalRespondents: number; questions: Array<{ questionText: string; type: string; responseCount: number; average?: number; distribution?: Record<string, number> }> } | null>(null);
  const [responses, setResponses] = useState<Record<string, string>>({});

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [questions, setQuestions] = useState([{ ...emptyQuestion }]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try { const res = await api.get("/workforce/surveys"); setSurveys(res.data.data || []); }
    catch { setSurveys([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const addQuestion = () => setQuestions((p) => [...p, { ...emptyQuestion }]);
  const removeQuestion = (i: number) => setQuestions((p) => p.filter((_, idx) => idx !== i));
  const updateQuestion = (i: number, key: string, val: string | boolean) => setQuestions((p) => p.map((q, idx) => idx === i ? { ...q, [key]: val } : q));

  const handleCreate = async () => {
    if (!title || questions.length === 0 || questions.some((q) => !q.questionText)) {
      setToast({ message: "Title and at least one question with text required", type: "error" }); return;
    }
    setSaving(true);
    try {
      await api.post("/workforce/surveys", {
        title, description,
        questions: questions.map((q, i) => ({
          questionText: q.questionText, type: q.type, sortOrder: i,
          options: q.options ? q.options.split(",").map((o) => o.trim()).filter(Boolean) : undefined,
          isRequired: q.isRequired,
        })),
      });
      setToast({ message: "Survey created", type: "success" }); setShowForm(false); fetchData();
    } catch (err: unknown) {
      setToast({ message: (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Failed", type: "error" });
    } finally { setSaving(false); }
  };

  const viewResults = async (id: string) => {
    try { const res = await api.get(`/workforce/surveys/${id}/results`); setResults(res.data.data); setShowResults(true); }
    catch { setToast({ message: "Failed to load results", type: "error" }); }
  };

  const openRespond = async (id: string) => {
    try {
      const res = await api.get(`/workforce/surveys/${id}`);
      setSelectedSurvey(res.data.data); setResponses({}); setShowRespond(true);
    } catch { setToast({ message: "Failed to load survey", type: "error" }); }
  };

  const submitResponses = async () => {
    if (!selectedSurvey?.questions) return;
    const missing = selectedSurvey.questions.filter((q) => q.isRequired && !responses[q.id]);
    if (missing.length > 0) { setToast({ message: `Please answer all required questions (${missing.length} missing)`, type: "error" }); return; }
    setSaving(true);
    try {
      await api.post(`/workforce/surveys/${selectedSurvey.id}/respond`, {
        responses: Object.entries(responses).map(([questionId, answer]) => ({ questionId, answer })),
      });
      setToast({ message: "Response submitted", type: "success" }); setShowRespond(false);
    } catch { setToast({ message: "Failed to submit", type: "error" }); }
    finally { setSaving(false); }
  };

  const updateStatus = async (id: string, status: string) => {
    try { await api.put(`/workforce/surveys/${id}/status`, { status }); setToast({ message: `Survey ${status}`, type: "success" }); fetchData(); }
    catch { setToast({ message: "Failed to update", type: "error" }); }
  };

  return (
    <PageWrapper title="Workforce Surveys" subtitle="Workforce Analytics - Create and manage surveys">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="flex justify-between items-center mb-6">
        <p className="text-sm text-[#9B93B8]">{surveys.length} survey(s)</p>
        <Button onClick={() => { setTitle(""); setDescription(""); setQuestions([{ ...emptyQuestion }]); setShowForm(true); }}><Plus size={16} /> New Survey</Button>
      </div>

      {loading ? <LoadingSpinner /> : surveys.length === 0 ? <EmptyState title="No surveys yet" icon={<ClipboardList size={32} />} /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {surveys.map((survey) => (
            <Card key={survey.id}>
              <CardBody>
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE] pr-2">{survey.title}</h3>
                  <Badge variant={survey.status === "active" ? "success" : survey.status === "completed" ? "purple" : "default"}>{survey.status}</Badge>
                </div>
                {survey.description && <p className="text-xs text-[#9B93B8] mb-3">{survey.description}</p>}
                <div className="flex items-center gap-4 text-xs text-[#9B93B8] mb-4">
                  <span>{survey._count?.questions || survey.questions?.length || 0} questions</span>
                  {survey.startDate && <span>Started {formatDate(survey.startDate)}</span>}
                </div>
                <div className="flex gap-2">
                  {survey.status === "draft" && <Button variant="secondary" className="text-xs py-1 px-3" onClick={() => updateStatus(survey.id, "active")}>Activate</Button>}
                  {survey.status === "active" && <Button variant="secondary" className="text-xs py-1 px-3" onClick={() => openRespond(survey.id)}><Send size={12} /> Respond</Button>}
                  <Button variant="ghost" className="text-xs py-1 px-3" onClick={() => viewResults(survey.id)}><Eye size={12} /> Results</Button>
                  {survey.status === "active" && <Button variant="ghost" className="text-xs py-1 px-3" onClick={() => updateStatus(survey.id, "completed")}>Close</Button>}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {/* Create Survey Modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title="Create Survey" size="xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <FormInput label="Title" value={title} onChange={setTitle} required />
          <FormTextarea label="Description" value={description} onChange={setDescription} />
        </div>
        <h4 className="text-xs font-semibold text-[#4C4566] dark:text-[#B8AEDD] mb-3">Questions</h4>
        {questions.map((q, i) => (
          <div key={i} className="flex gap-3 mb-3 items-start p-3 rounded-[10px] bg-[#F8F7FF] dark:bg-[#0E0B1F]">
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="sm:col-span-2"><FormInput label={`Q${i + 1}`} value={q.questionText} onChange={(v) => updateQuestion(i, "questionText", v)} placeholder="Question text" /></div>
              <FormSelect label="Type" value={q.type} onChange={(v) => updateQuestion(i, "type", v)} options={[
                { value: "rating", label: "Rating (1-5)" }, { value: "scale", label: "Scale (1-10)" },
                { value: "multiple_choice", label: "Multiple Choice" }, { value: "text", label: "Free Text" },
              ]} />
              {q.type === "multiple_choice" && <div className="sm:col-span-3"><FormInput label="Options (comma-separated)" value={q.options} onChange={(v) => updateQuestion(i, "options", v)} placeholder="Option A, Option B, Option C" /></div>}
            </div>
            {questions.length > 1 && <button onClick={() => removeQuestion(i)} className="mt-6 p-1.5 text-red-400 hover:text-red-600"><Trash2 size={14} /></button>}
          </div>
        ))}
        <Button variant="ghost" onClick={addQuestion} className="text-xs mb-4"><Plus size={12} /> Add Question</Button>
        <div className="flex justify-end gap-3 mt-4">
          <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
          <Button onClick={handleCreate} loading={saving}>Create Survey</Button>
        </div>
      </Modal>

      {/* Respond Modal */}
      <Modal open={showRespond} onClose={() => setShowRespond(false)} title={selectedSurvey?.title || "Survey"} size="lg">
        {selectedSurvey?.questions && (
          <div className="space-y-4">
            {selectedSurvey.questions.map((q) => (
              <div key={q.id} className="p-3 rounded-[10px] bg-[#F8F7FF] dark:bg-[#0E0B1F]">
                <p className="text-sm font-medium text-[#1E1B2E] dark:text-[#EDE9FE] mb-2">{q.questionText} {q.isRequired && <span className="text-red-500">*</span>}</p>
                {(q.type === "rating" || q.type === "scale") && (
                  <div className="flex gap-2">
                    {Array.from({ length: q.type === "rating" ? 5 : 10 }, (_, i) => i + 1).map((n) => (
                      <button key={n} onClick={() => setResponses((p) => ({ ...p, [q.id]: String(n) }))}
                        className={`w-9 h-9 rounded-[8px] text-sm font-medium transition-colors ${responses[q.id] === String(n) ? "bg-[#5B21B6] text-white" : "bg-white dark:bg-[#16122E] border border-[#E8E4F3] dark:border-[#2E2850] text-[#4C4566] dark:text-[#B8AEDD]"}`}>
                        {n}
                      </button>
                    ))}
                  </div>
                )}
                {q.type === "multiple_choice" && q.options && (
                  <div className="space-y-2">
                    {(q.options as string[]).map((opt) => (
                      <button key={opt} onClick={() => setResponses((p) => ({ ...p, [q.id]: opt }))}
                        className={`block w-full text-left px-3 py-2 rounded-[8px] text-sm transition-colors ${responses[q.id] === opt ? "bg-[#5B21B6] text-white" : "bg-white dark:bg-[#16122E] border border-[#E8E4F3] dark:border-[#2E2850] text-[#4C4566] dark:text-[#B8AEDD]"}`}>
                        {opt}
                      </button>
                    ))}
                  </div>
                )}
                {q.type === "text" && (
                  <textarea value={responses[q.id] || ""} onChange={(e) => setResponses((p) => ({ ...p, [q.id]: e.target.value }))} rows={2}
                    className="w-full px-3 py-2 rounded-[10px] text-sm bg-white dark:bg-[#16122E] border border-[#E8E4F3] dark:border-[#2E2850] text-[#1E1B2E] dark:text-[#EDE9FE] focus:outline-none focus:ring-2 focus:ring-[#5B21B6]/30 resize-none" />
                )}
              </div>
            ))}
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="ghost" onClick={() => setShowRespond(false)}>Cancel</Button>
              <Button onClick={submitResponses} loading={saving}>Submit Response</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Results Modal */}
      <Modal open={showResults} onClose={() => { setShowResults(false); setResults(null); }} title="Survey Results" size="lg">
        {results && (
          <div>
            <p className="text-sm text-[#4C4566] dark:text-[#B8AEDD] mb-4">{results.totalRespondents} respondent(s)</p>
            {results.questions.map((q, i) => (
              <div key={i} className="mb-4 p-3 rounded-[10px] bg-[#F8F7FF] dark:bg-[#0E0B1F]">
                <p className="text-sm font-medium text-[#1E1B2E] dark:text-[#EDE9FE] mb-2">{q.questionText}</p>
                <p className="text-xs text-[#9B93B8] mb-2">{q.responseCount} responses</p>
                {q.average !== undefined && (
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold font-serif text-[#5B21B6]">{q.average}</span>
                    <span className="text-xs text-[#9B93B8]">average</span>
                  </div>
                )}
                {q.distribution && (
                  <BarChartWidget
                    data={Object.entries(q.distribution).map(([name, value]) => ({ name, count: value }))}
                    bars={[{ key: "count", color: "#5B21B6" }]}
                    xKey="name" height={150}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </Modal>
    </PageWrapper>
  );
}
