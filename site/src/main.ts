import { schedule } from 'pinewood-derby-scheduler';
import './style.css';

interface Racer {
  id: number;
  name: string;
}

const form = document.getElementById('scheduler-form') as HTMLFormElement;
const resultsSection = document.getElementById('results') as HTMLElement;
const scheduleTable = document.getElementById('schedule-table') as HTMLElement;

form.addEventListener('submit', (e) => {
  e.preventDefault();

  const formData = new FormData(form);
  const racersText = formData.get('racers') as string;
  const numLanes = parseInt(formData.get('numLanes') as string, 10);
  const heatsPerRacer = parseInt(formData.get('heatsPerRacer') as string, 10);

  // Parse racer names from textarea
  const racerNames = racersText
    .split('\n')
    .map((name) => name.trim())
    .filter((name) => name.length > 0);

  if (racerNames.length === 0) {
    alert('Please enter at least one racer name');
    return;
  }

  // Create racer objects
  const racers: Racer[] = racerNames.map((name, index) => ({
    id: index + 1,
    name,
  }));

  try {
    const result = schedule(racers, { numLanes, heatsPerRacer });
    renderSchedule(result, numLanes);
    resultsSection.classList.remove('hidden');
  } catch (error) {
    alert(`Error: ${(error as Error).message}`);
  }
});

function renderSchedule(heats: (Racer | null)[][], numLanes: number): void {
  // Build table header
  const laneHeaders = Array.from({ length: numLanes }, (_, i) => `<th>Lane ${i + 1}</th>`).join('');

  // Build table rows
  const rows = heats
    .map((heat, heatIndex) => {
      const cells = heat
        .map((racer) => {
          if (racer === null) {
            return '<td class="empty">—</td>';
          }
          return `<td>${escapeHtml(racer.name)}</td>`;
        })
        .join('');

      return `<tr><td class="heat-number">Heat ${heatIndex + 1}</td>${cells}</tr>`;
    })
    .join('');

  scheduleTable.innerHTML = `
    <table>
      <thead>
        <tr>
          <th></th>
          ${laneHeaders}
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

