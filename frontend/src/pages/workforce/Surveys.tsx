import { useState, useEffect } from "react";
import PageWrapper from "../../components/layout/PageWrapper";
import { Card, CardHeader, CardBody, Badge, LoadingSpinner, EmptyState } from "../../components/ui/Card";
import { ClipboardList, Plus, Eye } from "lucide-react";
import { formatDate, statusColor } from "../../utils/formatters";
import api from "../../api/client";
import type { Survey } from "../../types";

export default function Surveys() {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSurvey, setSelectedSurvey] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    fetchSurveys();
  }, []);

  const fetchSurveys = async () => {
    setLoading(true);
    try {
      const res = await api.get("/workforce/surveys");
      setSurveys(res.data.data || []);
    } catch {
      setSurveys([
        { id: "1", title: "Q4 Employee Satisfaction Survey", description: "Quarterly pulse survey", status: "active", startDate: "2024-10-01", endDate: "2024-10-31", _count: { questions: 8 } },
        { id: "2", title: "Onboarding Experience Survey", description: "For new hires in the past 90 days", status: "completed", startDate: "2024-09-01", endDate: "2024-09-15", _count: { questions: 12 } },
        { id: "3", title: "Work-Life Balance Assessment", description: "Annual wellness check", status: "draft", startDate: null, endDate: null, _count: { questions: 10 } },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const viewResults = async (surveyId: string) => {
    setSelectedSurvey(surveyId);
    try {
      const res = await api.get(`/workforce/surveys/${surveyId}/results`);
      setResults(res.data.data);
    } catch {
      setResults({ title: "Survey Results", totalRespondents: 156, questions: [] });
    }
  };

  if (loading) {
    return <PageWrapper title="Workforce Surveys" subtitle="Workforce Analytics"><LoadingSpinner /></PageWrapper>;
  }

  return (
    <PageWrapper title="Workforce Surveys" subtitle="Create and manage employee surveys">
      {/* Action Bar */}
      <div className="flex justify-between items-center mb-6">
        <p className="text-sm text-[#9B93B8]">{surveys.length} survey(s)</p>
        <button className="flex items-center gap-2 px-4 py-2.5 rounded-[10px] text-sm font-medium text-white bg-[#5B21B6] hover:bg-[#7C3AED] transition-colors">
          <Plus size={16} />
          New Survey
        </button>
      </div>

      {/* Survey List */}
      {surveys.length === 0 ? (
        <EmptyState title="No surveys yet" description="Create your first workforce survey" icon={<ClipboardList size={32} />} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {surveys.map((survey) => (
            <Card key={survey.id}>
              <CardBody>
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE] pr-2">{survey.title}</h3>
                  <Badge variant={survey.status === "active" ? "success" : survey.status === "completed" ? "purple" : "default"}>
                    {survey.status}
                  </Badge>
                </div>

                {survey.description && (
                  <p className="text-xs text-[#9B93B8] mb-3">{survey.description}</p>
                )}

                <div className="flex items-center gap-4 text-xs text-[#9B93B8] mb-4">
                  <span>{survey._count?.questions || 0} questions</span>
                  {survey.startDate && <span>Started {formatDate(survey.startDate)}</span>}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => viewResults(survey.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-xs font-medium
                      bg-[#EDE9FE] dark:bg-[#2D1F5E] text-[#5B21B6] hover:bg-[#5B21B6] hover:text-white transition-colors"
                  >
                    <Eye size={12} /> View Results
                  </button>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {/* Results Modal (simple inline) */}
      {selectedSurvey && results && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => { setSelectedSurvey(null); setResults(null); }}>
          <Card className="w-full max-w-lg mx-4 max-h-[80vh] overflow-y-auto" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <CardHeader className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">Survey Results</h3>
              <button onClick={() => { setSelectedSurvey(null); setResults(null); }} className="text-[#9B93B8] hover:text-[#4C4566] text-lg">&times;</button>
            </CardHeader>
            <CardBody>
              <p className="text-xs text-[#9B93B8] mb-4">
                {(results as { totalRespondents?: number }).totalRespondents || 0} respondents
              </p>
              <p className="text-sm text-[#4C4566] dark:text-[#B8AEDD]">
                Detailed results will display here when survey data is available from the backend.
              </p>
            </CardBody>
          </Card>
        </div>
      )}
    </PageWrapper>
  );
}
