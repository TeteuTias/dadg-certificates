'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  format,
  startOfMonth,
  startOfWeek,
  addDays,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  startOfDay,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import './ScheduleClient.css';

interface Event {
  id: string;
  summary: string;
  start: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
}

const DATE_FMT = 'dd-MM-yyyy';
const DATETIME_FMT = 'dd-MM-yyyy HH:mm';

function parseDateOnlyAsLocal(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function getEventStartDate(event: Event): Date | null {
  if (event.start?.dateTime) return new Date(event.start.dateTime);
  if (event.start?.date) return parseDateOnlyAsLocal(event.start.date);
  return null;
}

function getEventEndDateExclusive(event: Event): Date | null {
  if (event.end?.dateTime) return new Date(event.end.dateTime);
  if (event.end?.date) return parseDateOnlyAsLocal(event.end.date);
  return null;
}

function eventOccursOnDay(event: Event, day: Date) {
  const dayStart = startOfDay(day);
  const start = getEventStartDate(event);

  if (!start) return false;
  if (event.start.dateTime) return isSameDay(start, dayStart);

  const endExclusive = getEventEndDateExclusive(event);
  if (!endExclusive) return isSameDay(start, dayStart);

  const startDay = startOfDay(start);
  const endDay = startOfDay(endExclusive);
  return dayStart >= startDay && dayStart < endDay;
}

function formatEventDate(event: Event) {
  if (event.start.dateTime) return format(new Date(event.start.dateTime), DATETIME_FMT);
  if (event.start.date) return format(parseDateOnlyAsLocal(event.start.date), DATE_FMT);
  return 'Data nao informada';
}

function formatEventEndDate(event: Event) {
  if (event.end?.dateTime) return format(new Date(event.end.dateTime), DATETIME_FMT);
  if (event.end?.date) return format(parseDateOnlyAsLocal(event.end.date), DATE_FMT);
  return null;
}

export default function ScheduleClient() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchEvents = async (month: Date) => {
    setLoading(true);
    try {
      const start = format(startOfMonth(month), 'yyyy-MM-dd');
      const end = format(startOfMonth(addMonths(month, 1)), 'yyyy-MM-dd');

      const res = await fetch(
        `/api/get/eventsByDate?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`
      );
      if (!res.ok) throw new Error('Erro ao buscar eventos');

      const data = await res.json();
      setEvents(data.items || []);
    } catch (error) {
      console.error('Erro ao buscar eventos:', error);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents(currentMonth);
  }, [currentMonth]);

  const eventDaySet = useMemo(() => {
    const set = new Set<string>();
    const keyOf = (d: Date) => format(startOfDay(d), 'yyyy-MM-dd');

    for (const ev of events) {
      const start = getEventStartDate(ev);
      if (!start) continue;

      if (ev.start.dateTime) {
        set.add(keyOf(start));
        continue;
      }

      const endExclusive = getEventEndDateExclusive(ev);
      if (!endExclusive) {
        set.add(keyOf(start));
        continue;
      }

      let cursor = startOfDay(start);
      const endDay = startOfDay(endExclusive);
      while (cursor < endDay) {
        set.add(keyOf(cursor));
        cursor = addDays(cursor, 1);
      }
    }

    return set;
  }, [events]);

  const eventsForSelectedDate = useMemo(() => {
    return events.filter((ev) => eventOccursOnDay(ev, selectedDate));
  }, [events, selectedDate]);

  const eventsForCurrentMonth = useMemo(() => {
    return [...events].sort((a, b) => {
      const dateA = getEventStartDate(a)?.getTime() ?? 0;
      const dateB = getEventStartDate(b)?.getTime() ?? 0;
      return dateA - dateB;
    });
  }, [events]);

  const nextEvent = useMemo(() => {
    const today = startOfDay(new Date()).getTime();
    return eventsForCurrentMonth.find((event) => {
      const start = getEventStartDate(event);
      return start ? startOfDay(start).getTime() >= today : false;
    });
  }, [eventsForCurrentMonth]);

  const goToToday = () => {
    const today = new Date();
    setCurrentMonth(today);
    setSelectedDate(today);
  };

  const selectEventDay = (event: Event) => {
    const start = getEventStartDate(event);
    if (!start) return;

    setCurrentMonth(start);
    setSelectedDate(start);
  };

  const renderEventCard = (event: Event, variant: 'default' | 'highlight' = 'default') => {
    const endLabel = formatEventEndDate(event);

    return (
      <div
        key={`${variant}-${event.id}`}
        className={`event-card ${variant === 'highlight' ? 'event-card-highlight' : ''}`}
      >
        <h4 className="event-name">{event.summary}</h4>

        <p className="event-time">
          <span className="font-bold">Inicio:</span> {formatEventDate(event)}
        </p>

        {endLabel && (
          <p className="event-time">
            <span className="font-bold">Fim:</span> {endLabel}
          </p>
        )}
      </div>
    );
  };

  const renderCells = () => {
    const monthStart = startOfMonth(currentMonth);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 0 });

    const rows = [];
    let day = startDate;

    for (let week = 0; week < 6; week++) {
      const days = [];

      for (let i = 0; i < 7; i++) {
        const cloneDay = day;
        const key = format(startOfDay(day), 'yyyy-MM-dd');
        const hasEvent = eventDaySet.has(key);
        const isToday = isSameDay(day, new Date());

        days.push(
          <div
            key={key}
            className={`calendar-day ${
              !isSameMonth(day, monthStart) ? 'other-month' : ''
            } ${isSameDay(day, selectedDate) ? 'selected' : ''} ${isToday ? 'today' : ''}`}
            onClick={() => setSelectedDate(cloneDay)}
          >
            {format(day, 'd')}
            {hasEvent && <span className="event-indicator"></span>}
          </div>
        );

        day = addDays(day, 1);
      }

      rows.push(
        <div key={`week-${week}`} className="calendar-grid">
          {days}
        </div>
      );
    }

    return <div>{rows}</div>;
  };

  return (
    <div className="calendar-wrapper">
      <div className="calendar-header">
        <button
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          className="calendar-nav-button"
        >
          Anterior
        </button>

        <h2 className="calendar-title">
          {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
        </h2>

        <div className="calendar-actions">
          <button onClick={goToToday} className="calendar-nav-button today-button">
            Hoje
          </button>

          <button
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="calendar-nav-button"
          >
            Proximo
          </button>
        </div>
      </div>

      <div className="calendar-content">
        <div className="calendar-main">
          <div className="calendar-weekdays">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'].map((d) => (
              <div key={d} className="weekday">
                {d}
              </div>
            ))}
          </div>

          {renderCells()}

          <div className="events-list selected-day-events">
            <h3 className="events-title">
              Eventos em {format(selectedDate, DATE_FMT)}
            </h3>

            {loading ? (
              <p className="loading-message">Carregando eventos...</p>
            ) : eventsForSelectedDate.length > 0 ? (
              eventsForSelectedDate.map((event) => renderEventCard(event))
            ) : (
              <p className="no-events-message">Nenhum evento para este dia.</p>
            )}
          </div>
        </div>

        <aside className="month-events-panel" aria-label="Eventos do mes">
          <div className="next-event-block">
            <p className="panel-eyebrow">Proximo evento</p>
            {loading ? (
              <p className="loading-message compact">Carregando...</p>
            ) : nextEvent ? (
              renderEventCard(nextEvent, 'highlight')
            ) : (
              <p className="no-events-message compact">Nenhum proximo evento neste mes.</p>
            )}
          </div>

          <div className="month-events-block">
            <div className="month-events-heading">
              <h3 className="events-title">Eventos do mes</h3>
              <span className="events-count">{eventsForCurrentMonth.length}</span>
            </div>

            {loading ? (
              <p className="loading-message compact">Carregando eventos...</p>
            ) : eventsForCurrentMonth.length > 0 ? (
              <div className="month-events-list">
                {eventsForCurrentMonth.map((event) => {
                  const start = getEventStartDate(event);
                  const active = start ? eventOccursOnDay(event, selectedDate) : false;

                  return (
                    <button
                      key={`month-${event.id}`}
                      type="button"
                      className={`month-event-item ${active ? 'active' : ''}`}
                      onClick={() => selectEventDay(event)}
                    >
                      <span className="month-event-date">
                        {start ? format(start, 'dd MMM', { locale: ptBR }) : '--'}
                      </span>
                      <span className="month-event-name">{event.summary}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="no-events-message compact">Nenhum evento cadastrado para este mes.</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
