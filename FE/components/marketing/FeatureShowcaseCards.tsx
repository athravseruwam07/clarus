"use client";

import { useEffect, useState } from "react";
import {
  ArrowRight,
  Building2,
  CalendarClock,
  CheckCircle2,
  Circle,
  Clock3,
  LockKeyhole,
  ShieldCheck
} from "lucide-react";

const TIMELINE_DAYS = [
  {
    label: "Tue",
    date: "Mar 24",
    items: [
      { title: "Professional Challenges", meta: "Assignment 5 due 11:59 PM" },
      { title: "Discussion reply", meta: "15 min follow-up block" }
    ]
  },
  {
    label: "Thu",
    date: "Mar 26",
    items: [
      { title: "Concept review", meta: "Tag weak topics from PD 19" },
      { title: "Quiz warm-up", meta: "20 min low-stakes prep" }
    ]
  },
  {
    label: "Sun",
    date: "Mar 29",
    items: [
      { title: "Major reflective draft", meta: "1.5 h focused writing block" },
      { title: "Calendar catch-up", meta: "Sync next week in one view" }
    ]
  }
] as const;

const PLAN_TASKS = [
  { title: "Review tagged concepts", meta: "25 min" },
  { title: "Complete practice set", meta: "45 min" },
  { title: "Write reflection outline", meta: "20 min" }
] as const;

const CONNECTION_STEPS = [
  {
    label: "Choose school",
    title: "Pick your Brightspace campus",
    detail: "Select your university once so Clarus knows which login flow to use."
  },
  {
    label: "Sign in securely",
    title: "Finish the normal school login",
    detail: "Clarus hands the auth window off to your school and never stores your password."
  },
  {
    label: "Workspace ready",
    title: "Courses and due work sync in",
    detail: "Your dashboard fills in with timeline data, ranked tasks, and next steps."
  }
] as const;

function TimelineDemoCard() {
  const [activeDay, setActiveDay] = useState(0);
  const activeTimeline = TIMELINE_DAYS[activeDay];

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setActiveDay((current) => (current + 1) % TIMELINE_DAYS.length);
    }, 2200);

    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <article className="card-glow flex h-full flex-col rounded-2xl border border-border/50 bg-surface-1/80 p-6 shadow-[0_2px_8px_rgba(0,0,0,0.3),_0_12px_40px_rgba(0,0,0,0.25)] backdrop-blur-sm transition-transform duration-200 hover:-translate-y-0.5">
      <div className="flex items-center gap-4">
        <div className="inline-flex rounded-xl border border-white/10 bg-white/[0.08] p-3 text-foreground shadow-[0_2px_8px_rgba(0,0,0,0.3),_inset_0_1px_0_rgba(255,255,255,0.08)]">
          <CalendarClock className="h-5 w-5" />
        </div>
        <h3 className="font-display text-lg font-semibold leading-snug tracking-[-0.02em]">
          Unified workload timeline
        </h3>
      </div>

      <p className="mt-4 text-sm leading-6 text-muted-foreground">
        A live academic view that keeps cycling through due dates, blocks, and upcoming work.
      </p>

      <div className="mt-6 rounded-2xl border border-white/8 bg-black/20 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.2em] text-foreground/45">
          <span>Live timeline</span>
          <span>Playing</span>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {TIMELINE_DAYS.map((day, index) => {
            const isActive = index === activeDay;

            return (
              <button
                key={day.label}
                className={`rounded-xl border px-3 py-2 text-left transition ${
                  isActive
                    ? "border-white/20 bg-white/[0.10] text-foreground shadow-[0_8px_18px_rgba(0,0,0,0.28)]"
                    : "border-white/8 bg-white/[0.03] text-foreground/65 hover:border-white/15 hover:bg-white/[0.06]"
                }`}
                onClick={() => setActiveDay(index)}
                type="button"
              >
                <div className="text-xs font-medium">{day.label}</div>
                <div className="mt-1 text-[11px] text-foreground/45">{day.date}</div>
              </button>
            );
          })}
        </div>

        <div className="mt-4 space-y-2">
          {activeTimeline.items.map((item) => (
            <div
              key={item.title}
              className="rounded-xl border border-white/8 bg-white/[0.04] px-3 py-2.5 text-left"
            >
              <div className="text-sm font-medium text-foreground">{item.title}</div>
              <div className="mt-1 text-xs text-muted-foreground">{item.meta}</div>
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}

function DailyPlanDemoCard() {
  const [completed, setCompleted] = useState<boolean[]>([true, false, false]);
  const completedCount = completed.filter(Boolean).length;
  const progress = (completedCount / PLAN_TASKS.length) * 100;

  useEffect(() => {
    const sequences: boolean[][] = [
      [true, false, false],
      [true, true, false],
      [true, true, true],
      [false, true, true],
      [true, false, true]
    ];

    let sequenceIndex = 0;
    const intervalId = window.setInterval(() => {
      sequenceIndex = (sequenceIndex + 1) % sequences.length;
      setCompleted(sequences[sequenceIndex]);
    }, 1900);

    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <article className="card-glow flex h-full flex-col rounded-2xl border border-border/50 bg-surface-1/80 p-6 shadow-[0_2px_8px_rgba(0,0,0,0.3),_0_12px_40px_rgba(0,0,0,0.25)] backdrop-blur-sm transition-transform duration-200 hover:-translate-y-0.5">
      <div className="flex items-center gap-4">
        <div className="inline-flex rounded-xl border border-white/10 bg-white/[0.08] p-3 text-foreground shadow-[0_2px_8px_rgba(0,0,0,0.3),_inset_0_1px_0_rgba(255,255,255,0.08)]">
          <CheckCircle2 className="h-5 w-5" />
        </div>
        <h3 className="font-display text-lg font-semibold leading-snug tracking-[-0.02em]">
          Actionable daily plan
        </h3>
      </div>

      <p className="mt-4 text-sm leading-6 text-muted-foreground">
        A small guided plan that keeps progressing on its own, with tasks you can still toggle yourself.
      </p>

      <div className="mt-6 rounded-2xl border border-white/8 bg-black/20 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-foreground/45">Today&apos;s plan</div>
            <div className="mt-1 text-sm font-medium text-foreground">
              {completedCount} of {PLAN_TASKS.length} blocks done
            </div>
          </div>
          <div className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs text-foreground/70">
            <Clock3 className="mr-1 inline h-3.5 w-3.5 align-[-2px]" />
            Live demo
          </div>
        </div>

        <div className="mt-4 h-2 rounded-full bg-white/[0.06]">
          <div
            className="h-2 rounded-full bg-white/80 transition-[width] duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="mt-4 space-y-2">
          {PLAN_TASKS.map((task, index) => {
            const isDone = completed[index];

            return (
              <button
                key={task.title}
                className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
                  isDone
                    ? "border-white/10 bg-white/[0.08]"
                    : "border-white/8 bg-white/[0.03] hover:border-white/15 hover:bg-white/[0.06]"
                }`}
                onClick={() =>
                  setCompleted((current) =>
                    current.map((value, currentIndex) => (currentIndex === index ? !value : value))
                  )
                }
                type="button"
              >
                {isDone ? (
                  <CheckCircle2 className="h-4.5 w-4.5 shrink-0 text-foreground" />
                ) : (
                  <Circle className="h-4.5 w-4.5 shrink-0 text-foreground/55" />
                )}
                <div className="min-w-0 flex-1">
                  <div className={`text-sm font-medium ${isDone ? "text-foreground/65 line-through" : "text-foreground"}`}>
                    {task.title}
                  </div>
                  <div className="text-xs text-muted-foreground">{task.meta}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </article>
  );
}

function ConnectionDemoCard() {
  const [activeStep, setActiveStep] = useState(0);
  const currentStep = CONNECTION_STEPS[activeStep];

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setActiveStep((current) => (current + 1) % CONNECTION_STEPS.length);
    }, 2300);

    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <article className="card-glow flex h-full flex-col rounded-2xl border border-border/50 bg-surface-1/80 p-6 shadow-[0_2px_8px_rgba(0,0,0,0.3),_0_12px_40px_rgba(0,0,0,0.25)] backdrop-blur-sm transition-transform duration-200 hover:-translate-y-0.5">
      <div className="flex items-center gap-4">
        <div className="inline-flex rounded-xl border border-white/10 bg-white/[0.08] p-3 text-foreground shadow-[0_2px_8px_rgba(0,0,0,0.3),_inset_0_1px_0_rgba(255,255,255,0.08)]">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <h3 className="font-display text-lg font-semibold leading-snug tracking-[-0.02em]">
          Secure Brightspace connection
        </h3>
      </div>

      <p className="mt-4 text-sm leading-6 text-muted-foreground">
        A looping secure setup preview that shows the login flow Clarus guides in the background.
      </p>

      <div className="mt-6 rounded-2xl border border-white/8 bg-black/20 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-foreground/45">
          <LockKeyhole className="h-3.5 w-3.5" />
          Playing secure flow
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          {CONNECTION_STEPS.map((step, index) => {
            const isActive = index === activeStep;
            const isDone = index < activeStep;

            return (
              <button
                key={step.label}
                className={`rounded-xl border px-3 py-2 text-left transition ${
                  isActive
                    ? "border-white/20 bg-white/[0.10] text-foreground"
                    : isDone
                      ? "border-white/10 bg-white/[0.06] text-foreground/80"
                      : "border-white/8 bg-white/[0.03] text-foreground/55 hover:border-white/15 hover:bg-white/[0.06]"
                }`}
                onClick={() => setActiveStep(index)}
                type="button"
              >
                <div className="truncate text-xs font-medium">{step.label}</div>
              </button>
            );
          })}
        </div>

        <div className="mt-4 rounded-xl border border-white/8 bg-white/[0.04] p-4">
          <div className="flex items-center gap-2">
            <div className="rounded-lg border border-white/10 bg-white/[0.06] p-2">
              {activeStep === 0 ? (
                <Building2 className="h-4 w-4" />
              ) : activeStep === 1 ? (
                <LockKeyhole className="h-4 w-4" />
              ) : (
                <ShieldCheck className="h-4 w-4" />
              )}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium text-foreground">{currentStep.title}</div>
              <div className="mt-1 text-xs leading-5 text-muted-foreground">{currentStep.detail}</div>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between rounded-xl border border-white/8 bg-black/20 px-3 py-2 text-xs text-foreground/70">
            <span>{activeStep < 2 ? "Encrypted session state" : "Synced and ready"}</span>
            {activeStep < 2 ? (
              <button
                className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-foreground transition hover:bg-white/[0.09]"
                onClick={() => setActiveStep((current) => Math.min(current + 1, CONNECTION_STEPS.length - 1))}
                type="button"
              >
                Next
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button
                className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-foreground transition hover:bg-white/[0.09]"
                onClick={() => setActiveStep(0)}
                type="button"
              >
                Replay
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

export default function FeatureShowcaseCards() {
  return (
    <div className="grid gap-5 md:grid-cols-3">
      <TimelineDemoCard />
      <DailyPlanDemoCard />
      <ConnectionDemoCard />
    </div>
  );
}
