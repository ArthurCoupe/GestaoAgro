import {
  Chart, ArcElement, BarController, BarElement, CategoryScale, Filler, Legend, LineController, LineElement,
  LinearScale, PointElement, Tooltip,
} from 'chart.js';

Chart.register(ArcElement, BarController, BarElement, CategoryScale, Filler, Legend,
  LineController, LineElement, LinearScale, PointElement, Tooltip);

Chart.defaults.font.family = "'Segoe UI',-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif";
Chart.defaults.color = '#6E6B4E';
Chart.defaults.font.size = 11;

export const GOLD = '#B89C3A';
export const OLIVE = '#8C7727';
export const OLIVEDK = '#3A3B22';
export const AMBER = '#AD6819';
export const GOLDS = '#D8C378';
export const GREEN = '#5C7A3B';
export const RED = '#B5502F';
export const CREAM = '#F2ECD8';
export const BLUE = '#3E6B7A';
export const CINZA = '#B8B4A5';

export const GRID = { color: CREAM };
export const PALETTE = [OLIVEDK, GOLD, AMBER, OLIVE, GOLDS, GREEN, BLUE, RED];

export const baseOpts = {
  responsive: true,
  maintainAspectRatio: false,
  scales: {
    x: { grid: { display: false } },
    y: { grid: GRID },
  },
} as const;

export const legB = {
  plugins: { legend: { position: 'bottom' as const, labels: { boxWidth: 12 } } },
};
export const noLeg = { plugins: { legend: { display: false } } };
