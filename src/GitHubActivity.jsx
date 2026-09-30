import { useLayoutEffect, useRef, useState } from 'react';
import activity from '../assets/github-activity.generated.json';
import { calendarLayout } from './contribution-calendar.js';

const { cells, columns, months } = calendarLayout(activity.days);
const step = 13;
const left = 30;
const top = 24;
const width = left + columns * step;
const profileUrl = `https://github.com/${activity.username}`;

export default function GitHubActivity() {
  const scrollerRef = useRef(null);
  const [selected, setSelected] = useState(null);
  const active = selected === null ? null : cells[selected];

  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (scroller) scroller.scrollLeft = scroller.scrollWidth;
  }, []);

  function onKeyDown(event) {
    const current = selected ?? cells.length - 1;
    const offsets = { ArrowLeft: -7, ArrowRight: 7, ArrowUp: -1, ArrowDown: 1 };
    let next;
    if (Object.hasOwn(offsets, event.key)) next = Math.max(0, Math.min(cells.length - 1, current + offsets[event.key]));
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = cells.length - 1;
    else return;
    event.preventDefault();
    setSelected(next);
    const scroller = scrollerRef.current;
    const svg = scroller.querySelector('svg');
    const x = (left + cells[next].column * step) * svg.getBoundingClientRect().width / width;
    if (x < scroller.scrollLeft + left) scroller.scrollLeft = Math.max(0, x - left);
    else if (x + step > scroller.scrollLeft + scroller.clientWidth) scroller.scrollLeft = x + step - scroller.clientWidth;
  }

  return (
    <section className="github-activity" aria-label="GitHub 活动">
      <div className="activity-header">
        <h3>GitHub 活动</h3>
        <a className="activity-profile" href={profileUrl} target="_blank" rel="noopener noreferrer">@{activity.username}</a>
      </div>
      <p className="activity-total">最近一年 <strong>{activity.total.toLocaleString('zh-CN')}</strong> 次贡献</p>
      <div className="activity-scroll" ref={scrollerRef}>
        <svg
          className="activity-calendar"
          viewBox={`0 0 ${width} 116`}
          role="group"
          aria-label="贡献日历，可用方向键查看日期，Home 和 End 跳到首日和末日"
          tabIndex="0"
          onKeyDown={onKeyDown}
          onFocus={() => setSelected((value) => value ?? cells.length - 1)}
        >
          {months.map((month) => <text key={month.column} x={left + month.column * step} y="12" className="activity-month">{month.label}</text>)}
          {[['一', 1], ['三', 3], ['五', 5]].map(([label, row]) => <text key={row} x="0" y={top + row * step + 8} className="activity-weekday">{label}</text>)}
          {cells.map((day, index) => (
            <rect
              key={day.date}
              className={`activity-day activity-level-${day.level}${selected === index ? ' is-selected' : ''}`}
              data-date={day.date}
              data-count={day.count}
              x={left + day.column * step}
              y={top + day.row * step}
              width="10"
              height="10"
              rx="2"
              onPointerEnter={() => setSelected(index)}
              onClick={() => setSelected(index)}
            >
              <title>{day.date}：{day.count} 次贡献</title>
            </rect>
          ))}
        </svg>
      </div>
      <div className="activity-footer">
        <output className="activity-day-detail" aria-live="polite">
          {active ? `${active.date}：${active.count} 次贡献` : `${cells[0].date} 至 ${cells.at(-1).date}`}
        </output>
        <div className="activity-legend" aria-label="颜色越深，贡献越多">
          <span>少</span>
          {[0, 1, 2, 3, 4].map((level) => <span key={level} className={`activity-swatch activity-level-${level}`} aria-hidden="true" />)}
          <span>多</span>
        </div>
      </div>
    </section>
  );
}
