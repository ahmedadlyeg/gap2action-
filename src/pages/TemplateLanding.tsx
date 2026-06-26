import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Edit2, Camera, LayoutTemplate, Zap, PenLine,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/context/AuthContext';
import { getTemplate, updateTemplate, getTemplateSections } from '@/services/store';
import { categories as seedCategories } from '@/services/mockData';
import type { Template } from '@/types';

// ─── Category → gradient ──────────────────────────────────────────────────────

function heroGradient(categoryName = ''): string {
  const n = categoryName.toLowerCase();
  if (n.includes('enterprise arch')) return 'from-blue-900 to-blue-700';
  if (n.includes('digital') || n.includes('technology')) return 'from-purple-900 to-purple-700';
  if (n.includes('data')) return 'from-teal-900 to-teal-700';
  if (n.includes('cyber')) return 'from-red-900 to-red-700';
  return 'from-slate-800 to-slate-600';
}

function lightGradient(categoryName = ''): string {
  const n = categoryName.toLowerCase();
  if (n.includes('enterprise arch')) return 'from-blue-100 to-blue-200';
  if (n.includes('digital') || n.includes('technology')) return 'from-purple-100 to-purple-200';
  if (n.includes('data')) return 'from-teal-100 to-teal-200';
  if (n.includes('cyber')) return 'from-red-100 to-red-200';
  return 'from-slate-100 to-slate-200';
}

// ─── Editable text block ──────────────────────────────────────────────────────

interface EditableBlockProps {
  value: string;
  onSave: (val: string) => void;
  placeholder: string;
  isAdmin: boolean;
  rows?: number;
}

function EditableBlock({ value, onSave, placeholder, isAdmin, rows = 5 }: EditableBlockProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => { setDraft(value); }, [value]);

  if (!isAdmin) {
    return value
      ? <p className="text-slate-700 leading-relaxed">{value}</p>
      : <p className="text-slate-400 italic">No description provided yet.</p>;
  }

  if (editing) {
    return (
      <div className="space-y-3">
        <textarea
          autoFocus
          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-primary/30"
          rows={rows}
          value={draft}
          onChange={e => setDraft(e.target.value)}
        />
        <div className="flex gap-2">
          <Button size="sm" onClick={() => { onSave(draft); setEditing(false); }}>Save</Button>
          <Button size="sm" variant="outline" onClick={() => { setDraft(value); setEditing(false); }}>Cancel</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2 group/edit">
      {value
        ? <p className="flex-1 text-slate-700 leading-relaxed">{value}</p>
        : <p className="flex-1 text-slate-400 italic">{placeholder}</p>
      }
      <button
        onClick={() => setEditing(true)}
        className="shrink-0 opacity-0 group-hover/edit:opacity-100 transition-opacity p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600"
        title="Edit"
      >
        <Edit2 size={14} />
      </button>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function TemplateLanding() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [template, setTemplate] = useState<Template | undefined>(() =>
    id ? getTemplate(id) : undefined
  );

  const sections = id ? (getTemplateSections(id) ?? []) : [];
  const totalQuestions = sections.reduce((n, s) => n + s.questions.length, 0);
  const estimatedMinutes = Math.ceil(totalQuestions * 1.5);

  const category = seedCategories.find(c => c.id === template?.categoryId);
  const gradient = heroGradient(category?.name);
  const lightGrad = lightGradient(category?.name);

  // Reload on store updates
  useEffect(() => {
    const reload = () => setTemplate(id ? getTemplate(id) : undefined);
    window.addEventListener('g2a-store-updated', reload);
    return () => window.removeEventListener('g2a-store-updated', reload);
  }, [id]);

  // ── Tagline inline edit ──
  const [editingTagline, setEditingTagline] = useState(false);
  const [taglineDraft, setTaglineDraft] = useState('');
  const taglineInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setTaglineDraft(template?.tagline ?? ''); }, [template?.tagline]);

  const saveTagline = () => {
    if (template) updateTemplate(template.id, { tagline: taglineDraft });
    setEditingTagline(false);
  };

  // ── Cover image upload ──
  const coverInputRef = useRef<HTMLInputElement>(null);
  const handleCoverUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !template) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const dataUrl = ev.target?.result as string;
      updateTemplate(template.id, { coverImageUrl: dataUrl });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // ── Not found ──
  if (!template) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
        <LayoutTemplate size={48} className="text-slate-300" />
        <h2 className="text-xl font-semibold text-slate-700">Template not found</h2>
        <p className="text-slate-500 text-sm">The template you're looking for doesn't exist or has been removed.</p>
        <Button variant="outline" onClick={() => navigate('/categories')}>← Back to Categories</Button>
      </div>
    );
  }

  const backUrl = category ? `/categories/${category.id}/templates` : '/categories';

  return (
    <div className="bg-slate-50 min-h-screen">

      {/* ── HERO BAND ─────────────────────────────────────────────────────────── */}
      <div className={`bg-gradient-to-br ${gradient} text-white`}>
        <div className="max-w-5xl mx-auto px-6 py-10">
          {/* Top bar */}
          <div className="flex items-center justify-between mb-10 flex-wrap gap-3">
            <button
              onClick={() => navigate(backUrl)}
              className="flex items-center gap-1.5 text-white/70 hover:text-white text-sm transition-colors"
            >
              <ArrowLeft size={15} /> Back to Templates
            </button>
            {isAdmin && (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="border-white/40 text-white bg-white/10 hover:bg-white/20"
                  onClick={() => navigate(`/templates/${template.id}/builder`)}
                >
                  <Edit2 size={13} className="mr-1.5" /> Edit Template
                </Button>
                {template.status === 'Active' && (
                  <Button
                    size="sm"
                    className="bg-white text-slate-800 hover:bg-white/90"
                    onClick={() => navigate(`/events/new?templateId=${template.id}`)}
                  >
                    <Zap size={13} className="mr-1.5" /> Launch Assessment
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Title */}
          <h1
            className="text-5xl md:text-6xl font-semibold tracking-tight leading-tight mb-4"
            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
          >
            {template.name}
          </h1>

          {/* Badges */}
          <div className="flex flex-wrap items-center gap-2 mb-5">
            {category && (
              <span className="border border-white/50 text-white text-xs font-medium rounded-full px-3 py-1">
                {category.name}
              </span>
            )}
            <span className={`text-xs font-semibold rounded-full px-3 py-1 ${
              template.status === 'Active' ? 'bg-green-400/30 text-green-100' :
              template.status === 'Draft'  ? 'bg-yellow-400/30 text-yellow-100' :
                                             'bg-slate-400/30 text-slate-200'
            }`}>
              {template.status}
            </span>
            <span className="text-white/50 text-xs font-mono">v{template.version}</span>
          </div>

          {/* Tagline */}
          {isAdmin ? (
            editingTagline ? (
              <input
                ref={taglineInputRef}
                autoFocus
                value={taglineDraft}
                onChange={e => setTaglineDraft(e.target.value)}
                onBlur={saveTagline}
                onKeyDown={e => { if (e.key === 'Enter') saveTagline(); if (e.key === 'Escape') setEditingTagline(false); }}
                placeholder="Add a tagline…"
                className="w-full max-w-xl bg-transparent border-b border-white/40 text-white/90 italic text-xl outline-none placeholder:text-white/30 pb-1"
              />
            ) : (
              <button
                onClick={() => setEditingTagline(true)}
                className="text-left group/tl flex items-center gap-2"
              >
                <span className={`text-xl italic ${template.tagline ? 'text-white/80' : 'text-white/30'}`}>
                  {template.tagline || 'Add a tagline…'}
                </span>
                <PenLine size={14} className="text-white/30 opacity-0 group-hover/tl:opacity-100 transition-opacity shrink-0" />
              </button>
            )
          ) : template.tagline ? (
            <p className="text-xl italic text-white/80">{template.tagline}</p>
          ) : null}
        </div>
      </div>

      {/* ── CONTENT ──────────────────────────────────────────────────────────── */}
      <div className="max-w-3xl mx-auto px-4">

        {/* ── COVER IMAGE ─────────────────────────────────────────────── */}
        <div className="max-w-lg mx-auto mt-8 mb-6">
          <div className="relative group/cover rounded-2xl overflow-hidden shadow-xl aspect-video">
            {template.coverImageUrl ? (
              <img
                src={template.coverImageUrl}
                alt={template.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className={`w-full h-full bg-gradient-to-br ${lightGrad} flex flex-col items-center justify-center gap-2`}>
                <LayoutTemplate size={80} className="text-white/60" style={{ color: 'rgba(255,255,255,0.4)' }} />
                <span className="text-sm text-white/40" style={{ color: 'rgba(0,0,0,0.25)' }}>Cover Image</span>
              </div>
            )}
            {isAdmin && (
              <>
                <div
                  className="absolute inset-0 bg-black/40 opacity-0 group-hover/cover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 cursor-pointer"
                  onClick={() => coverInputRef.current?.click()}
                >
                  <Camera size={28} className="text-white" />
                  <span className="text-white text-sm font-medium">Upload Image</span>
                </div>
                <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
              </>
            )}
          </div>
        </div>

        {/* ── STATS ROW ───────────────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row gap-4 mt-6">
          {[
            { value: sections.length, label: 'Sections' },
            { value: totalQuestions, label: 'Questions' },
            { value: `~${estimatedMinutes} min`, label: 'Est. reading time' },
          ].map(({ value, label }) => (
            <div key={label} className="flex-1 bg-white rounded-xl shadow-sm p-6 text-center">
              <p className="text-3xl font-bold text-slate-800">{value}</p>
              <p className="text-sm text-slate-500 mt-1">{label}</p>
            </div>
          ))}
        </div>

        {/* ── DEFINITION ──────────────────────────────────────────────── */}
        <div className="mt-6 bg-white rounded-2xl shadow-sm p-6 md:p-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-slate-800">About This Assessment</h2>
          </div>
          <EditableBlock
            value={template.definition ?? ''}
            onSave={val => updateTemplate(template.id, { definition: val })}
            placeholder="Click the edit icon to add a description for this template."
            isAdmin={isAdmin}
            rows={5}
          />
        </div>

        {/* ── EXPLANATION + SECTIONS ───────────────────────────────────── */}
        <div className="mt-6 bg-white rounded-2xl shadow-sm p-6 md:p-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-slate-800">What Will Be Evaluated?</h2>
          </div>
          <EditableBlock
            value={template.explanation ?? ''}
            onSave={val => updateTemplate(template.id, { explanation: val })}
            placeholder="Click the edit icon to explain what this assessment covers."
            isAdmin={isAdmin}
            rows={4}
          />

          {sections.length > 0 && (
            <div className="mt-6">
              <p className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
                Assessment Sections
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {sections.map((sec, idx) => (
                  <div key={sec.id} className="flex items-center gap-3 bg-slate-50 rounded-lg p-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary text-xs font-bold">
                      {idx + 1}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{sec.name}</p>
                      <p className="text-xs text-slate-500">{sec.questions.length} question{sec.questions.length !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── CTA FOOTER ──────────────────────────────────────────────── */}
        <div className="mt-8 mb-12">
          {template.status === 'Active' ? (
            <div className="flex justify-center">
              <Button
                size="lg"
                className="px-10"
                onClick={() => navigate(`/events/new?templateId=${template.id}`)}
              >
                Launch Assessment →
              </Button>
            </div>
          ) : template.status === 'Draft' ? (
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-sm text-amber-800">
                This template is still a draft. Activate it before launching an assessment.
              </p>
              {isAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 border-amber-300 text-amber-800 hover:bg-amber-100"
                  onClick={() => navigate(`/templates/${template.id}/builder`)}
                >
                  Open in Builder →
                </Button>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
