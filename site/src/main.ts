import { schedule, type ScheduleOptions, type ScheduleCriterion } from 'pinewood-derby-scheduler';
import './style.css';

interface Racer {
  carNumber: string;
  subgroup: string;
}

interface GroupedSchedule {
  subgroup: string;
  heats: (Racer | null)[][];
}

// Initialize dropdowns
function initDropdowns(): void {
  const numLanesSelect = document.getElementById('numLanes') as HTMLSelectElement;
  const heatsPerRacerSelect = document.getElementById('heatsPerRacer') as HTMLSelectElement;

  // Populate lanes (2-16, default 8)
  for (let i = 2; i <= 16; i++) {
    const option = document.createElement('option');
    option.value = String(i);
    option.textContent = String(i);
    if (i === 8) option.selected = true;
    numLanesSelect.appendChild(option);
  }

  // Populate heats per racer (1-10, default 3)
  for (let i = 1; i <= 10; i++) {
    const option = document.createElement('option');
    option.value = String(i);
    option.textContent = String(i);
    if (i === 3) option.selected = true;
    heatsPerRacerSelect.appendChild(option);
  }
}

// Set up priority list drag-and-drop
function initPriorityList(): void {
  const list = document.getElementById('priority-list') as HTMLElement;
  const hiddenInput = document.getElementById('prioritize') as HTMLInputElement;
  let draggedItem: HTMLElement | null = null;

  function updateHiddenInput(): void {
    const items = list.querySelectorAll('.priority-item');
    const values: string[] = [];
    items.forEach((item, index) => {
      values.push((item as HTMLElement).dataset.value as string);
      // Update rank numbers
      const rankEl = item.querySelector('.priority-rank');
      if (rankEl) rankEl.textContent = String(index + 1);
    });
    hiddenInput.value = values.join(',');
  }

  function handleDragStart(e: DragEvent): void {
    draggedItem = e.target as HTMLElement;
    draggedItem.classList.add('dragging');
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/html', draggedItem.innerHTML);
    }
  }

  function handleDragEnd(): void {
    if (draggedItem) {
      draggedItem.classList.remove('dragging');
      draggedItem = null;
    }
    list.querySelectorAll('.priority-item').forEach((item) => {
      item.classList.remove('drag-over');
    });
    updateHiddenInput();
  }

  function handleDragOver(e: DragEvent): void {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move';
    }
  }

  function handleDragEnter(e: DragEvent): void {
    const target = (e.target as HTMLElement).closest('.priority-item') as HTMLElement;
    if (target && target !== draggedItem) {
      target.classList.add('drag-over');
    }
  }

  function handleDragLeave(e: DragEvent): void {
    const target = (e.target as HTMLElement).closest('.priority-item') as HTMLElement;
    if (target) {
      target.classList.remove('drag-over');
    }
  }

  function handleDrop(e: DragEvent): void {
    e.preventDefault();
    const target = (e.target as HTMLElement).closest('.priority-item') as HTMLElement;
    if (target && draggedItem && target !== draggedItem) {
      const items = Array.from(list.querySelectorAll('.priority-item'));
      const draggedIndex = items.indexOf(draggedItem);
      const targetIndex = items.indexOf(target);

      if (draggedIndex < targetIndex) {
        target.after(draggedItem);
      } else {
        target.before(draggedItem);
      }
    }
    list.querySelectorAll('.priority-item').forEach((item) => {
      item.classList.remove('drag-over');
    });
  }

  // Add event listeners to each item
  list.querySelectorAll('.priority-item').forEach((item) => {
    item.addEventListener('dragstart', handleDragStart as EventListener);
    item.addEventListener('dragend', handleDragEnd);
    item.addEventListener('dragover', handleDragOver as EventListener);
    item.addEventListener('dragenter', handleDragEnter as EventListener);
    item.addEventListener('dragleave', handleDragLeave as EventListener);
    item.addEventListener('drop', handleDrop as EventListener);
  });
}

// Parse CSV text into array of objects
function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];

  // Split by comma or tab
  const headers = lines[0].split(/[,\t]/).map((h) => h.trim());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(/[,\t]/).map((v) => v.trim());
    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] || '';
    });
    rows.push(row);
  }

  return rows;
}

// Group racers by subgroup
function groupBySubgroup(rows: Record<string, string>[]): Map<string, Racer[]> {
  const groups = new Map<string, Racer[]>();

  for (const row of rows) {
    const subgroup = row['Subgroup'] || '';
    const carNumber = row['Car#'] || '';

    if (!subgroup || !carNumber) continue;

    if (!groups.has(subgroup)) {
      groups.set(subgroup, []);
    }
    groups.get(subgroup)!.push({ carNumber, subgroup });
  }

  // Sort racers within each group by car number
  for (const [, racers] of groups) {
    racers.sort((a, b) => a.carNumber.localeCompare(b.carNumber, undefined, { numeric: true }));
  }

  return groups;
}

// Generate schedules for all subgroups
function generateSchedules(
  groups: Map<string, Racer[]>,
  options: ScheduleOptions
): GroupedSchedule[] {
  const schedules: GroupedSchedule[] = [];

  for (const [subgroup, racers] of groups) {
    try {
      const heats = schedule(racers, options);
      schedules.push({ subgroup, heats });
    } catch (error) {
      console.error(`Error scheduling ${subgroup}:`, error);
    }
  }

  return schedules;
}

// Get color class for a car number
function getColorClass(carNumber: string, colorMap: Map<string, number>): string {
  if (!colorMap.has(carNumber)) {
    colorMap.set(carNumber, colorMap.size);
  }
  const index = colorMap.get(carNumber)! % 48; // 48 color variants
  return `racer-${index}`;
}

// Render the schedule tables
function renderSchedule(schedules: GroupedSchedule[], numLanes: number): void {
  const output = document.getElementById('schedule-output') as HTMLElement;
  const colorMap = new Map<string, number>();

  // Build lane headers
  const laneHeaders = Array.from({ length: numLanes }, (_, i) => `<th>Lane ${i + 1}</th>`).join('');

  let html = '';

  for (const { subgroup, heats } of schedules) {
    html += `<table class="schedule-table">
      <thead>
        <tr>${laneHeaders}</tr>
      </thead>
      <tbody>
        <tr class="subgroup-row">
          <td colspan="${numLanes}">${escapeHtml(subgroup)}</td>
        </tr>`;

    for (const heat of heats) {
      html += '<tr>';
      for (let lane = 0; lane < numLanes; lane++) {
        const racer = heat[lane];
        if (racer === null) {
          html += '<td class="bye-cell">Bye</td>';
        } else {
          const colorClass = getColorClass(racer.carNumber, colorMap);
          html += `<td class="${colorClass}">${escapeHtml(racer.carNumber)}</td>`;
        }
      }
      html += '</tr>';
    }

    html += '</tbody></table>';
  }

  output.innerHTML = html;
}

// Generate CSV content for download
function generateCsvContent(schedules: GroupedSchedule[], numLanes: number): string {
  const rows: string[][] = [];

  // Header row
  const headers = Array.from({ length: numLanes }, (_, i) => `Lane ${i + 1}`);
  rows.push(headers);

  for (const { heats } of schedules) {
    for (const heat of heats) {
      const row: string[] = [];
      for (let lane = 0; lane < numLanes; lane++) {
        const racer = heat[lane];
        row.push(racer ? racer.carNumber : 'Bye');
      }
      rows.push(row);
    }
  }

  return rows.map((row) => row.join(',')).join('\n');
}

// Set up CSV download
function setupDownload(csvContent: string): void {
  const downloadLink = document.getElementById('downloadLink') as HTMLAnchorElement;
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  downloadLink.href = url;
}

// Escape HTML to prevent XSS
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Show error message
function showError(message: string): void {
  const output = document.getElementById('schedule-output') as HTMLElement;
  output.innerHTML = `<div class="error-message">${escapeHtml(message)}</div>`;
  const results = document.getElementById('results') as HTMLElement;
  results.classList.remove('hidden');
}

// Main form handler
function handleSubmit(e: Event): void {
  e.preventDefault();

  const form = e.target as HTMLFormElement;
  const formData = new FormData(form);

  const csvText = formData.get('inputCsv') as string;
  const numLanes = parseInt(formData.get('numLanes') as string, 10);
  const heatsPerRacer = parseInt(formData.get('heatsPerRacer') as string, 10);
  const prioritizeStr = formData.get('prioritize') as string;
  const prioritize = prioritizeStr.split(',') as ScheduleCriterion[];

  // Validate input
  if (!csvText.trim()) {
    showError('Please paste CSV data containing Subgroup and Car# columns.');
    return;
  }

  // Parse CSV
  const rows = parseCsv(csvText);
  if (rows.length === 0) {
    showError('No valid data found. Please check your CSV format.');
    return;
  }

  // Check for required columns
  const firstRow = rows[0];
  if (!('Subgroup' in firstRow) || !('Car#' in firstRow)) {
    showError('CSV must contain "Subgroup" and "Car#" columns.');
    return;
  }

  // Group by subgroup
  const groups = groupBySubgroup(rows);
  if (groups.size === 0) {
    showError('No valid racers found. Each row needs a Subgroup and Car# value.');
    return;
  }

  // Generate schedules
  const options: ScheduleOptions = { numLanes, heatsPerRacer, prioritize };
  const schedules = generateSchedules(groups, options);

  if (schedules.length === 0) {
    showError('Failed to generate schedules. Please check your input data.');
    return;
  }

  // Render results
  renderSchedule(schedules, numLanes);

  // Set up download
  const csvContent = generateCsvContent(schedules, numLanes);
  setupDownload(csvContent);

  // Show results section
  const results = document.getElementById('results') as HTMLElement;
  results.classList.remove('hidden');

  // Scroll to results
  results.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Initialize the app
function init(): void {
  initDropdowns();
  initPriorityList();

  const form = document.getElementById('scheduler-form') as HTMLFormElement;
  form.addEventListener('submit', handleSubmit);
}

// Run when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
