'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { addDays, endOfDay, format, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import './UpcomingSchedulePopup.css';

interface CalendarEvent {
  id: string;
  summary: string;
  start: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  location?: string;
}

const getEventDate = (dateTime?: string, date?: string): Date | null => {
  if (dateTime) return new Date(dateTime);
  if (date) {
    const [year, month, day] = date.split('-').map(Number);
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day);
  }
  return null;
};

export default function UpcomingSchedulePopup() {
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);

  const range = useMemo(() => {
    const now = new Date();
    const start = startOfDay(now);
    const end = endOfDay(addDays(now, 13));
    return { start, end };
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    const apply = () => {
      const mobile = mq.matches;
      setIsMobile(mobile);
      setExpanded(!mobile);
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    if (dismissed) return;

    const fetchUpcoming = async () => {
      setLoading(true);
      try {
        const startIso = range.start.toISOString();
        const endIso = range.end.toISOString();
        const res = await fetch(
          `/api/get/eventsByDate?start=${encodeURIComponent(
            startIso
          )}&end=${encodeURIComponent(endIso)}`
        );
        if (!res.ok) throw new Error('Erro ao buscar eventos');
        const data = await res.json();
        setEvents((data.items || []) as CalendarEvent[]);
      } catch {
        setEvents([]);
      } finally {
        setLoading(false);
      }
    };

    fetchUpcoming();
  }, [dismissed, range.end, range.start]);

  const items = useMemo(() => {
    const filtered = events
      .map((e) => ({ event: e, date: getEventDate(e.start.dateTime, e.start.date) }))
      .filter((x): x is { event: CalendarEvent; date: Date } => !!x.date)
      .filter(({ date }) => date >= range.start && date <= range.end)
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    return filtered;
  }, [events, range.end, range.start]);

  const close = () => {
    setDismissed(true);
  };

  useEffect(() => {
    const handleOpen = () => {
      setDismissed(false);
      setExpanded(true); // Optional: also expand it when opened from header
    };
    window.addEventListener('open-schedule-popup', handleOpen);
    return () => window.removeEventListener('open-schedule-popup', handleOpen);
  }, []);

  if (dismissed) return null;

  return (
    <aside className={`upcoming-popup ${expanded ? 'is-expanded' : 'is-collapsed'}`}>
      <div className="upcoming-popup__header">
        <button
          type="button"
          className="upcoming-popup__toggle"
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? 'Recolher programação' : 'Expandir programação'}
        >
          <span className="upcoming-popup__toggleIcon" aria-hidden="true">
            {expanded ? '▾' : '▸'}
          </span>
          <span className="upcoming-popup__title">
            Acompanhe a programação das próximas semanas
          </span>
        </button>

        <button
          type="button"
          className="upcoming-popup__close"
          onClick={close}
          aria-label="Fechar"
          title="Fechar"
        >
          ×
        </button>
      </div>

      {expanded && (
        <div className="upcoming-popup__body">
          <div className="upcoming-popup__sub">
            <span>
              {format(range.start, "dd 'de' MMM", { locale: ptBR })} –{' '}
              {format(range.end, "dd 'de' MMM", { locale: ptBR })}
            </span>
            <Link className="upcoming-popup__link" href="/eventos">
              Abrir calendário
            </Link>
          </div>

          {loading ? (
            <div className="upcoming-popup__empty">Carregando…</div>
          ) : items.length === 0 ? (
            <div className="upcoming-popup__empty">Sem eventos nas próximas 2 semanas.</div>
          ) : (
            <ul className="upcoming-popup__list">
              {items.slice(0, 10).map(({ event, date }) => {
                const timeLabel = event.start.dateTime
                  ? format(date, 'HH:mm', { locale: ptBR })
                  : null;

                return (
                  <li key={event.id} className="upcoming-popup__item">
                    <div className="upcoming-popup__date">
                      {format(date, "EEE dd/MM", { locale: ptBR })}
                    </div>
                    <div className="upcoming-popup__content">
                      <div className="upcoming-popup__summary">{event.summary}</div>
                      <div className="upcoming-popup__meta">
                        {timeLabel ? <span>{timeLabel}</span> : <span>Dia inteiro</span>}
                        {event.location ? <span className="upcoming-popup__sep">•</span> : null}
                        {event.location ? <span>{event.location}</span> : null}
                      </div>
                    </div>
                  </li>
                );
              })}
              {items.length > 10 ? (
                <li className="upcoming-popup__more">
                  +{items.length - 10} evento(s).{' '}
                  <Link className="upcoming-popup__linkInline" href="/eventos">
                    Ver todos
                  </Link>
                </li>
              ) : null}
            </ul>
          )}

          {isMobile ? (
            <div className="upcoming-popup__hint">Toque na setinha para recolher.</div>
          ) : null}
        </div>
      )}
    </aside>
  );
}

