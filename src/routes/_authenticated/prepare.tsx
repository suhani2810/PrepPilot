import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  analyzeJobDescription,
  deleteStudyDocument,
  getPreparationData,
  processStudyDocument,
  savePreparationFeedback,
  submitCodingSolution,
  submitTechnicalAnswer,
} from "@/lib/preparation.functions";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState, SectionEyebrow, Skeleton, Surface } from "@/components/prep/primitives";
import {
  ArrowRight,
  BookOpen,
  Brain,
  BriefcaseBusiness,
  CheckCircle2,
  Code2,
  FileText,
  Gauge,
  ExternalLink,
  Loader2,
  MessageSquareText,
  RefreshCw,
  Sparkles,
  Target,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/prepare")({
  head: () => ({
    meta: [
      { title: "Preparation Studio — PrepPilot" },
      {
        name: "description",
        content:
          "Turn study material and job descriptions into grounded technical and coding practice.",
      },
    ],
  }),
  component: PreparationStudio,
});

type DocumentRow = {
  id: string;
  filename: string;
  subject: string | null;
  document_type: string;
  visibility: string;
  processing_status: string;
  processing_error: string | null;
  page_count: number | null;
  analysis: {
    overview?: string;
    keyConcepts?: string[];
    definitions?: { term: string; definition: string }[];
    rules?: string[];
    citations?: { page: number; excerpt: string }[];
  };
  created_at: string;
};

type ConceptRow = {
  id: string;
  document_id: string;
  name: string;
  description: string;
  difficulty: string;
  prerequisites: string[];
  related_coding_topics: string[];
  source_page: number | null;
};

type QuestionRow = {
  id: string;
  document_id: string | null;
  job_description_id: string | null;
  question_text: string;
  topic: string;
  difficulty: number;
  source_reference: { page?: number; excerpt?: string };
};

type JobRow = {
  id: string;
  title: string | null;
  company: string | null;
  analysis: {
    roleTitle?: string;
    requiredSkills?: string[];
    preferredSkills?: string[];
    technologies?: string[];
    responsibilities?: string[];
    behavioralCompetencies?: string[];
    preparationPlan?: string[];
  };
  created_at: string;
};

type CodingProblem = {
  id: string;
  slug: string;
  title: string;
  statement: string;
  difficulty: string;
  topics: string[];
  constraints: string[];
  examples: { input: string; output: string }[];
  starter_code: Record<string, string>;
  explanation: string;
  source?: "internal" | "google_sheet";
  problem_url?: string | null;
  solution_url?: string | null;
  companies?: string[];
  can_submit?: boolean;
};

type PreparationData = {
  documents: DocumentRow[];
  concepts: ConceptRow[];
  questions: QuestionRow[];
  jobs: JobRow[];
  problems: CodingProblem[];
  codingContext: {
    hasReadyMaterial: boolean;
    materialHasCodingContent: boolean;
    materialTopics: string[];
    recommendedProblemIds: string[];
    availableTopics: string[];
  };
  codeRunnerConfigured: boolean;
  codeRunnerProvider: string;
  attempts: { id: string; question_id: string; score: number; feedback: unknown }[];
  submissions: {
    id: string;
    problem_id: string;
    status: string;
    passed_tests: number;
    total_tests: number;
    score: number;
    result: unknown;
  }[];
  readiness: {
    overall: number | null;
    technical: number | null;
    coding: number | null;
    interview: number | null;
    weaknesses: string[];
  };
};

function PreparationStudio() {
  const getData = useServerFn(getPreparationData);
  const [data, setData] = useState<PreparationData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData((await getData()) as PreparationData);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load preparation data");
    } finally {
      setLoading(false);
    }
  }, [getData]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <SectionEyebrow>Preparation engine</SectionEyebrow>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-[2.5rem]">
            Preparation studio
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Convert your material and target roles into cited technical practice, reviewed coding
            problems, and a measurable readiness signal.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {loading && !data ? (
        <div className="mt-7 grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((key) => (
            <Skeleton key={key} className="h-28" />
          ))}
        </div>
      ) : (
        <>
          <ReadinessStrip data={data} />
          <Tabs defaultValue="materials" className="mt-7">
            <TabsList className="grid h-auto w-full grid-cols-2 gap-1 p-1 sm:grid-cols-4">
              <TabsTrigger value="materials">Materials</TabsTrigger>
              <TabsTrigger value="technical">Technical practice</TabsTrigger>
              <TabsTrigger value="coding">Coding</TabsTrigger>
              <TabsTrigger value="roles">Target roles</TabsTrigger>
            </TabsList>
            <TabsContent value="materials" className="mt-5">
              <MaterialsPanel data={data} onChanged={load} />
            </TabsContent>
            <TabsContent value="technical" className="mt-5">
              <TechnicalPanel data={data} onChanged={load} />
            </TabsContent>
            <TabsContent value="coding" className="mt-5">
              <CodingPanel data={data} onChanged={load} />
            </TabsContent>
            <TabsContent value="roles" className="mt-5">
              <RolesPanel data={data} onChanged={load} />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}

function ReadinessStrip({ data }: { data: PreparationData | null }) {
  const readiness = data?.readiness;
  const scores = [
    { label: "Technical", value: readiness?.technical, icon: Brain },
    { label: "Coding", value: readiness?.coding, icon: Code2 },
    { label: "Interview", value: readiness?.interview, icon: MessageSquareText },
  ];
  return (
    <Surface elevated className="mt-7 p-5 sm:p-6">
      <div className="grid gap-5 lg:grid-cols-[0.8fr_2fr] lg:items-center">
        <div className="flex items-center gap-4">
          <div className="grid h-14 w-14 place-items-center rounded-xl bg-gradient-primary text-primary-foreground shadow-glow">
            <Gauge className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Combined readiness
            </p>
            <p className="mt-1 font-display text-3xl font-semibold">
              {readiness?.overall == null ? "—" : `${readiness.overall}%`}
            </p>
            <p className="text-xs text-muted-foreground">Estimate, not a hiring guarantee</p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {scores.map(({ label, value, icon: Icon }) => (
            <div key={label}>
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Icon className="h-3.5 w-3.5" /> {label}
                </span>
                <span className="font-medium">{value == null ? "No data" : `${value}%`}</span>
              </div>
              <Progress value={value ?? 0} />
            </div>
          ))}
        </div>
      </div>
      {!!readiness?.weaknesses.length && (
        <div className="mt-5 border-t border-border/60 pt-4">
          <p className="text-xs font-medium text-muted-foreground">Current weak areas</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {readiness.weaknesses.map((weakness) => (
              <Badge key={weakness} variant="secondary">
                {weakness}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </Surface>
  );
}

function MaterialsPanel({
  data,
  onChanged,
}: {
  data: PreparationData | null;
  onChanged: () => Promise<void>;
}) {
  const processDocument = useServerFn(processStudyDocument);
  const removeDocument = useServerFn(deleteStudyDocument);
  const feedback = useServerFn(savePreparationFeedback);
  const [file, setFile] = useState<File | null>(null);
  const [subject, setSubject] = useState("Data Structures and Algorithms");
  const [documentType, setDocumentType] = useState("notes");
  const [visibility, setVisibility] = useState("private");
  const [busy, setBusy] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(data?.documents[0]?.id ?? null);
  const selected =
    data?.documents.find((document) => document.id === selectedId) ?? data?.documents[0];
  const concepts = data?.concepts.filter((concept) => concept.document_id === selected?.id) ?? [];

  const upload = async () => {
    if (!file) return;
    if (file.type !== "application/pdf") return toast.error("Choose a PDF document");
    if (file.size > 20 * 1024 * 1024) return toast.error("PDF must be 20 MB or smaller");
    if (!subject.trim()) return toast.error("Add a subject");
    setBusy(true);
    let path = "";
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Not signed in");
      path = `${auth.user.id}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
      const { error } = await supabase.storage.from("study-materials").upload(path, file, {
        contentType: "application/pdf",
        upsert: false,
      });
      if (error) throw error;
      const result = await processDocument({
        data: {
          storagePath: path,
          filename: file.name,
          fileSize: file.size,
          subject,
          documentType: documentType as "notes" | "slides" | "syllabus" | "book" | "other",
          visibility: visibility as "private" | "group" | "review" | "college",
        },
      });
      toast.success(result.duplicate ? "This document was already processed" : "Material is ready");
      setSelectedId(result.documentId);
      setFile(null);
      await onChanged();
    } catch (error) {
      if (path) await supabase.storage.from("study-materials").remove([path]);
      toast.error(error instanceof Error ? error.message : "Processing failed");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (documentId: string) => {
    if (!window.confirm("Delete this document and its generated practice data?")) return;
    try {
      await removeDocument({ data: { documentId } });
      setSelectedId(null);
      toast.success("Document deleted");
      await onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed");
    }
  };

  const rate = async (rating: "helpful" | "partly_helpful" | "incorrect" | "not_relevant") => {
    if (!selected) return;
    await feedback({ data: { targetType: "summary", targetId: selected.id, rating } });
    toast.success("Feedback saved");
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[0.9fr_1.4fr]">
      <div className="space-y-5">
        <Surface elevated className="p-5">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
              <Upload className="h-4 w-4" />
            </span>
            <div>
              <h2 className="font-display text-xl font-semibold">Upload material</h2>
              <p className="text-xs text-muted-foreground">Private by default · PDF · 20 MB max</p>
            </div>
          </div>
          <div className="mt-5 space-y-4">
            <div>
              <Label htmlFor="study-file">Study PDF</Label>
              <Input
                id="study-file"
                type="file"
                accept="application/pdf"
                className="mt-1.5"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </div>
            <div>
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                className="mt-1.5"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Type</Label>
                <Select value={documentType} onValueChange={setDocumentType}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["notes", "slides", "syllabus", "book", "other"].map((value) => (
                      <SelectItem key={value} value={value}>
                        {value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Visibility</Label>
                <Select value={visibility} onValueChange={setVisibility}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="private">Private</SelectItem>
                    <SelectItem value="group">Defined group</SelectItem>
                    <SelectItem value="review">Submit for review</SelectItem>
                    <SelectItem value="college">College library</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button
              onClick={upload}
              disabled={!file || busy}
              className="w-full bg-gradient-primary text-primary-foreground"
            >
              {busy ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              {busy ? "Extracting and building practice…" : "Process material"}
            </Button>
          </div>
        </Surface>

        <Surface className="p-4">
          <p className="px-1 text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Your materials
          </p>
          <div className="mt-3 space-y-2">
            {!data?.documents.length ? (
              <p className="px-1 py-5 text-sm text-muted-foreground">No material uploaded yet.</p>
            ) : (
              data.documents.map((document) => (
                <button
                  key={document.id}
                  type="button"
                  onClick={() => setSelectedId(document.id)}
                  className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition ${selected?.id === document.id ? "border-primary/50 bg-primary/5" : "border-border/60 hover:border-primary/30"}`}
                >
                  <FileText className="h-4 w-4 shrink-0 text-primary" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{document.filename}</span>
                    <span className="block text-xs text-muted-foreground">
                      {document.subject} · {document.page_count ?? "—"} pages
                    </span>
                  </span>
                  <Badge variant={document.processing_status === "ready" ? "secondary" : "outline"}>
                    {document.processing_status}
                  </Badge>
                </button>
              ))
            )}
          </div>
        </Surface>
      </div>

      <Surface elevated className="p-5 sm:p-6">
        {!selected ? (
          <EmptyState
            icon={<BookOpen className="h-5 w-5" />}
            title="No material selected"
            description="Upload a PDF to create a grounded summary, concept map, and practice questions."
          />
        ) : selected.processing_status === "failed" ? (
          <EmptyState
            icon={<FileText className="h-5 w-5" />}
            title="Processing failed"
            description={selected.processing_error ?? "Try uploading the document again."}
          />
        ) : (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <SectionEyebrow>PDF summary</SectionEyebrow>
                <h2 className="mt-2 font-display text-2xl font-semibold">{selected.filename}</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {selected.subject} · {selected.visibility}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => remove(selected.id)}
                className="text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" /> Delete
              </Button>
            </div>
            <p className="mt-5 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
              {selected.analysis?.overview || "Summary is not available yet."}
            </p>
            {!!selected.analysis?.keyConcepts?.length && (
              <div className="mt-5 flex flex-wrap gap-2">
                {selected.analysis.keyConcepts.map((concept) => (
                  <Badge key={concept} variant="secondary">
                    {concept}
                  </Badge>
                ))}
              </div>
            )}
            <div className="mt-7">
              <h3 className="font-display text-lg font-semibold">Concept map</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {concepts.map((concept) => (
                  <div
                    key={concept.id}
                    className="rounded-lg border border-border/60 bg-card/60 p-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium">{concept.name}</p>
                      <Badge variant="outline">{concept.difficulty}</Badge>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                      {concept.description}
                    </p>
                    {concept.source_page && (
                      <p className="mt-2 text-[11px] text-primary">
                        Source page {concept.source_page}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
            {!!selected.analysis?.citations?.length && (
              <div className="mt-7">
                <h3 className="font-display text-lg font-semibold">Source citations</h3>
                <div className="mt-3 space-y-2">
                  {selected.analysis.citations.map((citation, index) => (
                    <div
                      key={`${citation.page}-${index}`}
                      className="rounded-lg border border-border/60 p-3 text-xs text-muted-foreground"
                    >
                      <span className="font-medium text-primary">Page {citation.page}</span> · “
                      {citation.excerpt}”
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4">
              <p className="text-xs text-muted-foreground">Was this PDF summary useful?</p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => rate("helpful")}>
                  Helpful
                </Button>
                <Button size="sm" variant="outline" onClick={() => rate("incorrect")}>
                  Incorrect
                </Button>
              </div>
            </div>
          </>
        )}
      </Surface>
    </div>
  );
}

function TechnicalPanel({
  data,
  onChanged,
}: {
  data: PreparationData | null;
  onChanged: () => Promise<void>;
}) {
  const submit = useServerFn(submitTechnicalAnswer);
  const feedbackFn = useServerFn(savePreparationFeedback);
  const [source, setSource] = useState<string>(
    data?.documents[0]?.id ?? data?.jobs[0]?.id ?? "all",
  );
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [roundComplete, setRoundComplete] = useState(false);
  const [lastEvaluation, setLastEvaluation] = useState<{
    question: QuestionRow;
    result: { score: number; feedback: string; nextAction: string; weaknesses: string[] };
  } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [questionOrder, setQuestionOrder] = useState<string[]>([]);
  const questions = useMemo(
    () =>
      data?.questions.filter(
        (question) =>
          source === "all" ||
          question.document_id === source ||
          question.job_description_id === source,
      ) ?? [],
    [data, source],
  );
  const orderedQuestions = useMemo(() => {
    if (!questionOrder.length) return questions;
    const byId = new Map(questions.map((question) => [question.id, question]));
    return questionOrder
      .map((id) => byId.get(id))
      .filter((question): question is QuestionRow => !!question);
  }, [questionOrder, questions]);
  const activeIndex = orderedQuestions.findIndex((question) => question.id === activeQuestionId);
  const activeQuestion = activeIndex >= 0 ? orderedQuestions[activeIndex] : null;
  const activeDocument = activeQuestion?.document_id
    ? data?.documents.find((document) => document.id === activeQuestion.document_id)
    : null;

  useEffect(() => {
    setActiveQuestionId(null);
    setRoundComplete(false);
    setLastEvaluation(null);
    setQuestionOrder([]);
  }, [source]);

  useEffect(() => {
    if (questions.length && questionOrder.length !== questions.length) {
      setQuestionOrder(
        [...questions].sort(() => Math.random() - 0.5).map((question) => question.id),
      );
    }
  }, [questionOrder.length, questions]);

  useEffect(() => {
    if (!roundComplete && orderedQuestions.length && !activeQuestion) {
      setActiveQuestionId(orderedQuestions[0].id);
    }
  }, [activeQuestion, orderedQuestions, roundComplete]);

  const evaluate = async (question: QuestionRow) => {
    const answer = answers[question.id]?.trim();
    if (!answer) return toast.error("Write an answer first");
    setBusyId(question.id);
    try {
      const result = await submit({ data: { questionId: question.id, answer } });
      setLastEvaluation({ question, result });
      const currentIndex = orderedQuestions.findIndex((item) => item.id === question.id);
      const nextQuestion = orderedQuestions[currentIndex + 1];
      if (nextQuestion) {
        setActiveQuestionId(nextQuestion.id);
        toast.success(`Answer evaluated · Question ${currentIndex + 2} is ready`);
      } else {
        setActiveQuestionId(null);
        setRoundComplete(true);
        toast.success("Technical round completed");
      }
      await onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Evaluation failed");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5">
      <Surface elevated className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <SectionEyebrow>Adaptive technical round</SectionEyebrow>
          <h2 className="mt-2 font-display text-2xl font-semibold">Technical questions</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            PDF-based questions show the page citation used to create each question.
          </p>
        </div>
        <div className="w-full sm:w-72">
          <Label>Question source</Label>
          <Select value={source} onValueChange={setSource}>
            <SelectTrigger className="mt-1.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All prepared sources</SelectItem>
              {data?.documents.map((document) => (
                <SelectItem key={document.id} value={document.id}>
                  {document.subject || document.filename}
                </SelectItem>
              ))}
              {data?.jobs.map((job) => (
                <SelectItem key={job.id} value={job.id}>
                  {job.title || "Target role"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Surface>
      {lastEvaluation && (
        <Surface className="border-primary/20 bg-primary/5 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-widest text-primary">
                Previous answer evaluated
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {lastEvaluation.question.question_text}
              </p>
            </div>
            <span className="font-display text-2xl font-semibold">
              {Math.round(lastEvaluation.result.score * 10)}%
            </span>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">{lastEvaluation.result.feedback}</p>
          <p className="mt-2 text-xs">
            <span className="font-medium">Next action:</span> {lastEvaluation.result.nextAction}
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {lastEvaluation.result.weaknesses.map((item) => (
                <Badge key={item} variant="outline">
                  {item}
                </Badge>
              ))}
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={async () => {
                await feedbackFn({
                  data: {
                    targetType: "evaluation",
                    targetId: lastEvaluation.question.id,
                    rating: "helpful",
                  },
                });
                toast.success("Feedback saved");
              }}
            >
              Helpful
            </Button>
          </div>
        </Surface>
      )}
      {!orderedQuestions.length ? (
        <Surface className="p-8">
          <EmptyState
            icon={<Brain className="h-5 w-5" />}
            title="No generated questions"
            description={
              data?.documents.some((document) => document.processing_status === "failed")
                ? `The PDF could not be processed: ${data.documents.find((document) => document.processing_status === "failed")?.processing_error ?? "unknown processing error"}`
                : "No usable technical questions were generated yet. Re-process the PDF after checking that an AI provider is configured."
            }
          />
        </Surface>
      ) : roundComplete ? (
        <Surface className="p-8">
          <EmptyState
            icon={<CheckCircle2 className="h-5 w-5" />}
            title="Technical round completed"
            description={`You answered all ${orderedQuestions.length} questions from this source.`}
          />
          <div className="mt-5 flex justify-center">
            <Button
              variant="outline"
              onClick={() => {
                setAnswers({});
                setLastEvaluation(null);
                setRoundComplete(false);
                setActiveQuestionId(orderedQuestions[0]?.id ?? null);
              }}
            >
              Practice these questions again
            </Button>
          </div>
        </Surface>
      ) : activeQuestion ? (
        <Surface key={activeQuestion.id} className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">
              Question {activeIndex + 1} of {orderedQuestions.length}
            </Badge>
            <Badge variant="outline">{activeQuestion.topic}</Badge>
            <span className="text-xs text-muted-foreground">
              Difficulty {activeQuestion.difficulty}/5
            </span>
          </div>
          <Progress
            value={((activeIndex + 1) / orderedQuestions.length) * 100}
            className="mt-4 h-1.5"
          />
          <h3 className="mt-4 font-display text-xl font-semibold">
            {activeQuestion.question_text}
          </h3>
          {activeQuestion.source_reference?.page && (
            <div className="mt-4 rounded-lg border border-border/60 bg-secondary/30 p-4">
              <p className="text-xs font-medium uppercase tracking-widest text-primary">
                Source citation
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {activeDocument ? `${activeDocument.filename} · ` : "Material source · "}Page{" "}
                {activeQuestion.source_reference.page}
              </p>
            </div>
          )}
          <Textarea
            className="mt-4 min-h-32"
            placeholder="Explain your reasoning clearly…"
            value={answers[activeQuestion.id] ?? ""}
            onChange={(event) =>
              setAnswers((current) => ({
                ...current,
                [activeQuestion.id]: event.target.value,
              }))
            }
          />
          <div className="mt-3 flex justify-end">
            <Button
              onClick={() => evaluate(activeQuestion)}
              disabled={busyId === activeQuestion.id}
            >
              {busyId === activeQuestion.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {activeIndex + 1 === orderedQuestions.length
                ? "Evaluate and finish"
                : "Evaluate and continue"}
            </Button>
          </div>
        </Surface>
      ) : null}
    </div>
  );
}

function CodingPanel({
  data,
  onChanged,
}: {
  data: PreparationData | null;
  onChanged: () => Promise<void>;
}) {
  const submit = useServerFn(submitCodingSolution);
  const [problemId, setProblemId] = useState("");
  const [language, setLanguage] = useState("javascript");
  const [unrelatedTopic, setUnrelatedTopic] = useState("");
  const [practiceUnrelated, setPracticeUnrelated] = useState(false);
  const allProblems = useMemo(() => data?.problems ?? [], [data?.problems]);
  const codingContext = data?.codingContext;
  const recommendedProblems = useMemo(() => {
    const recommendedIds = new Set(codingContext?.recommendedProblemIds ?? []);
    return allProblems.filter((problem) => recommendedIds.has(problem.id));
  }, [allProblems, codingContext?.recommendedProblemIds]);
  const visibleProblems = useMemo(() => {
    if (codingContext?.materialHasCodingContent) {
      return recommendedProblems.length ? recommendedProblems : allProblems;
    }
    if (!practiceUnrelated || !unrelatedTopic) return [];
    return allProblems.filter((problem) => problem.topics.includes(unrelatedTopic));
  }, [
    allProblems,
    codingContext?.materialHasCodingContent,
    practiceUnrelated,
    recommendedProblems,
    unrelatedTopic,
  ]);
  const selected =
    visibleProblems.find((problem) => problem.id === problemId) ?? visibleProblems[0];
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    status: string;
    passedTests: number;
    totalTests: number;
    score: number;
    stderr: string;
    runtimeMs: number | null;
    memoryKb: number | null;
  } | null>(null);

  useEffect(() => {
    if (selected) setCode(selected.starter_code?.[language] ?? "");
  }, [selected, language]);

  useEffect(() => {
    if (!unrelatedTopic && codingContext?.availableTopics[0]) {
      setUnrelatedTopic(codingContext.availableTopics[0]);
    }
  }, [codingContext?.availableTopics, unrelatedTopic]);

  useEffect(() => {
    if (visibleProblems.length && !visibleProblems.some((problem) => problem.id === problemId)) {
      setProblemId(visibleProblems[0].id);
    }
  }, [problemId, visibleProblems]);

  const run = async () => {
    if (!selected || selected.can_submit === false) return;
    setBusy(true);
    setResult(null);
    try {
      const output = await submit({ data: { problemId: selected.id, language, sourceCode: code } });
      setResult(output);
      await onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Submission failed");
    } finally {
      setBusy(false);
    }
  };

  if (!allProblems.length)
    return (
      <Surface className="p-8">
        <EmptyState
          icon={<Code2 className="h-5 w-5" />}
          title="No coding problems"
          description="Apply the preparation migration to seed the reviewed DSA library."
        />
      </Surface>
    );
  if (!codingContext?.materialHasCodingContent && !practiceUnrelated)
    return (
      <Surface elevated className="p-6 sm:p-8">
        <SectionEyebrow>Coding practice</SectionEyebrow>
        <h2 className="mt-2 font-display text-2xl font-semibold">
          No coding topic was found in your material
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
          {codingContext?.hasReadyMaterial
            ? "The uploaded material does not appear to be related to programming. Would you like to practise an unrelated reviewed coding problem?"
            : "Upload and process study material first, or choose a topic for an unrelated reviewed coding problem."}
        </p>
        <div className="mt-5 flex max-w-xl flex-col gap-3 sm:flex-row">
          <Select value={unrelatedTopic} onValueChange={setUnrelatedTopic}>
            <SelectTrigger className="sm:flex-1">
              <SelectValue placeholder="Choose a coding topic" />
            </SelectTrigger>
            <SelectContent>
              {(codingContext?.availableTopics ?? []).map((topic) => (
                <SelectItem key={topic} value={topic}>
                  {topic}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            disabled={!unrelatedTopic}
            onClick={() => {
              const first = allProblems.find((problem) => problem.topics.includes(unrelatedTopic));
              if (first) setProblemId(first.id);
              setPracticeUnrelated(true);
            }}
          >
            Practice this topic
          </Button>
        </div>
      </Surface>
    );
  if (!selected)
    return (
      <Surface className="p-8">
        <EmptyState
          icon={<Code2 className="h-5 w-5" />}
          title="No matching coding problem"
          description="Choose another topic or add a reviewed problem for this material."
        />
      </Surface>
    );
  return (
    <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
      <Surface elevated className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <SectionEyebrow>
              {selected.source === "google_sheet"
                ? "Connected Google Sheet"
                : "Reviewed problem library"}
            </SectionEyebrow>
            <h2 className="mt-2 font-display text-2xl font-semibold">{selected.title}</h2>
          </div>
          <Badge variant="outline">{selected.difficulty}</Badge>
        </div>
        <Select
          value={selected.id}
          onValueChange={(value) => {
            setProblemId(value);
            setResult(null);
          }}
        >
          <SelectTrigger className="mt-5">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {visibleProblems.map((problem) => (
              <SelectItem key={problem.id} value={problem.id}>
                {problem.title}
                {problem.source === "google_sheet" ? " · Sheet" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="mt-5 text-sm leading-6 text-muted-foreground">{selected.statement}</p>
        {codingContext?.materialHasCodingContent && codingContext.materialTopics.length > 0 && (
          <p className="mt-3 text-xs text-muted-foreground">
            Recommended from your material: {codingContext.materialTopics.join(", ")}
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          {selected.topics.map((topic) => (
            <Badge key={topic} variant="secondary">
              {topic}
            </Badge>
          ))}
        </div>
        {selected.companies && selected.companies.length > 0 && (
          <p className="mt-3 text-xs text-muted-foreground">
            Companies: {selected.companies.join(", ")}
          </p>
        )}
        {(selected.problem_url || selected.solution_url) && (
          <div className="mt-5 flex flex-wrap gap-2">
            {selected.problem_url && (
              <Button asChild>
                <a href={selected.problem_url} target="_blank" rel="noreferrer">
                  Open problem <ExternalLink className="ml-2 h-4 w-4" />
                </a>
              </Button>
            )}
            {selected.solution_url && (
              <Button variant="outline" asChild>
                <a href={selected.solution_url} target="_blank" rel="noreferrer">
                  Video solution <ExternalLink className="ml-2 h-4 w-4" />
                </a>
              </Button>
            )}
          </div>
        )}
        {selected.constraints.length > 0 && (
          <div className="mt-6">
            <p className="text-sm font-medium">Constraints</p>
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
              {selected.constraints.map((constraint) => (
                <li key={constraint}>· {constraint}</li>
              ))}
            </ul>
          </div>
        )}
        {selected.examples.length > 0 && (
          <div className="mt-6">
            <p className="text-sm font-medium">Examples</p>
            {selected.examples.map((example, index) => (
              <pre
                key={index}
                className="mt-2 overflow-x-auto rounded-lg bg-secondary/50 p-3 text-xs"
              >
                Input: {example.input}
                {"\n"}Output: {example.output}
              </pre>
            ))}
          </div>
        )}
      </Surface>

      <Surface elevated className="p-5 sm:p-6">
        {selected.source === "google_sheet" ? (
          <div className="flex min-h-80 flex-col justify-center">
            <SectionEyebrow>External practice question</SectionEyebrow>
            <h2 className="mt-2 font-display text-xl font-semibold">
              Solve this problem on its source platform
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              The connected sheet supplies the topic, difficulty, problem link, and solution link,
              but it does not contain hidden test cases. Open the problem to submit against its
              official checker. In-app execution will be enabled only after a sandboxed runner and
              test cases are connected.
            </p>
            {selected.problem_url && (
              <Button className="mt-5 self-start" asChild>
                <a href={selected.problem_url} target="_blank" rel="noreferrer">
                  Open official problem <ExternalLink className="ml-2 h-4 w-4" />
                </a>
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3">
              <div>
                <SectionEyebrow>Isolated execution</SectionEyebrow>
                <h2 className="mt-2 font-display text-xl font-semibold">Solution editor</h2>
              </div>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="javascript">JavaScript</SelectItem>
                  <SelectItem value="python">Python</SelectItem>
                  <SelectItem value="c">C</SelectItem>
                  <SelectItem value="cpp">C++</SelectItem>
                  <SelectItem value="csharp">C#</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Textarea
              value={code}
              onChange={(event) => setCode(event.target.value)}
              spellCheck={false}
              className="mt-4 min-h-80 font-mono text-xs leading-5"
            />
            {data?.codeRunnerProvider === "piston" && (
              <p className="mt-3 text-xs leading-5 text-muted-foreground">
                Free MVP execution is provided by the public Piston service. Your submitted code and
                the problem tests are sent to Piston for isolated execution. Do not include secrets
                or personal data in your solution.
              </p>
            )}
            <div className="mt-4 flex justify-end">
              <Button
                onClick={run}
                disabled={
                  busy ||
                  code.trim().length < 10 ||
                  !data?.codeRunnerConfigured ||
                  selected.can_submit === false
                }
                className="bg-gradient-primary text-primary-foreground"
              >
                {busy ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Code2 className="mr-2 h-4 w-4" />
                )}
                Run hidden tests
              </Button>
            </div>
            {!data?.codeRunnerConfigured && (
              <p className="mt-3 text-sm text-destructive">
                Code checking is unavailable because the isolated runner is not configured. Set the
                server-only CODE_RUNNER_URL and CODE_RUNNER_API_KEY values, then restart PrepPilot.
              </p>
            )}
            {result && (
              <div className="mt-5 rounded-xl border border-border/60 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">{result.status.replaceAll("_", " ")}</p>
                  <span className="font-display text-2xl font-semibold">{result.score}%</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Passed {result.passedTests} of {result.totalTests} tests ·{" "}
                  {result.runtimeMs ?? "—"} ms · {result.memoryKb ?? "—"} KB
                </p>
                {result.stderr && (
                  <pre className="mt-3 overflow-x-auto rounded-lg bg-destructive/5 p-3 text-xs text-destructive">
                    {result.stderr}
                  </pre>
                )}
                {result.status === "accepted" && (
                  <p className="mt-4 text-sm">
                    <span className="font-medium">Reviewed explanation:</span>{" "}
                    {selected.explanation}
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </Surface>
    </div>
  );
}

function RolesPanel({
  data,
  onChanged,
}: {
  data: PreparationData | null;
  onChanged: () => Promise<void>;
}) {
  const analyze = useServerFn(analyzeJobDescription);
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [rawText, setRawText] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectedId, setSelectedId] = useState(data?.jobs[0]?.id ?? null);
  const selected = data?.jobs.find((job) => job.id === selectedId) ?? data?.jobs[0];

  const submit = async () => {
    setBusy(true);
    try {
      const result = await analyze({
        data: { title: title || undefined, company: company || undefined, rawText },
      });
      setSelectedId(result.jobDescriptionId);
      setRawText("");
      toast.success("Target role analyzed");
      await onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Analysis failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[0.9fr_1.3fr]">
      <Surface elevated className="p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
            <BriefcaseBusiness className="h-4 w-4" />
          </span>
          <div>
            <h2 className="font-display text-xl font-semibold">Add target role</h2>
            <p className="text-xs text-muted-foreground">
              Paste a job description to map skills and practice.
            </p>
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="role-title">Role title</Label>
            <Input
              id="role-title"
              className="mt-1.5"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Software Engineer"
            />
          </div>
          <div>
            <Label htmlFor="company">Company</Label>
            <Input
              id="company"
              className="mt-1.5"
              value={company}
              onChange={(event) => setCompany(event.target.value)}
              placeholder="Optional"
            />
          </div>
        </div>
        <div className="mt-4">
          <Label htmlFor="job-description">Job description</Label>
          <Textarea
            id="job-description"
            className="mt-1.5 min-h-64"
            value={rawText}
            onChange={(event) => setRawText(event.target.value)}
            placeholder="Paste responsibilities, required skills, and qualifications…"
          />
        </div>
        <Button
          className="mt-4 w-full bg-gradient-primary text-primary-foreground"
          onClick={submit}
          disabled={busy || rawText.trim().length < 80}
        >
          {busy ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Target className="mr-2 h-4 w-4" />
          )}
          Extract skills and build plan
        </Button>
        {!!data?.jobs.length && (
          <div className="mt-6 border-t border-border/60 pt-4">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Saved roles
            </p>
            <div className="mt-2 space-y-2">
              {data.jobs.map((job) => (
                <button
                  type="button"
                  key={job.id}
                  onClick={() => setSelectedId(job.id)}
                  className={`w-full rounded-lg border p-3 text-left ${selected?.id === job.id ? "border-primary/50 bg-primary/5" : "border-border/60"}`}
                >
                  <span className="block text-sm font-medium">
                    {job.title || job.analysis.roleTitle || "Target role"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {job.company || "Company not specified"}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </Surface>

      <Surface elevated className="p-5 sm:p-6">
        {!selected ? (
          <EmptyState
            icon={<BriefcaseBusiness className="h-5 w-5" />}
            title="No target role"
            description="Paste a job description to create a role-specific preparation plan."
          />
        ) : (
          <>
            <SectionEyebrow>Role preparation map</SectionEyebrow>
            <h2 className="mt-2 font-display text-2xl font-semibold">
              {selected.title || selected.analysis.roleTitle}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {selected.company || "Company not specified"}
            </p>
            <SkillGroup title="Required skills" items={selected.analysis.requiredSkills} />
            <SkillGroup title="Technologies" items={selected.analysis.technologies} />
            <SkillGroup
              title="Behavioral competencies"
              items={selected.analysis.behavioralCompetencies}
            />
            {!!selected.analysis.preparationPlan?.length && (
              <div className="mt-7">
                <h3 className="font-display text-lg font-semibold">Preparation plan</h3>
                <ol className="mt-3 space-y-3">
                  {selected.analysis.preparationPlan.map((step, index) => (
                    <li
                      key={step}
                      className="flex gap-3 rounded-lg border border-border/60 p-3 text-sm text-muted-foreground"
                    >
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                        {index + 1}
                      </span>
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
            )}
            <div className="mt-7 flex justify-end">
              <Link to="/interview/new">
                <Button>
                  Start role interview <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </>
        )}
      </Surface>
    </div>
  );
}

function SkillGroup({ title, items }: { title: string; items?: string[] }) {
  if (!items?.length) return null;
  return (
    <div className="mt-6">
      <h3 className="text-sm font-medium">{title}</h3>
      <div className="mt-2 flex flex-wrap gap-2">
        {items.map((item) => (
          <Badge key={item} variant="secondary">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            {item}
          </Badge>
        ))}
      </div>
    </div>
  );
}
