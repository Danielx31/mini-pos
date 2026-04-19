<script setup>
import { computed } from "vue";
import { Bar, Line, Doughnut } from "vue-chartjs";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const props = defineProps({
  data: {
    type: Array,
    required: true,
  },
  type: {
    type: String,
    default: "line", // 'line', 'bar', 'doughnut'
  },
  xAxisLabel: {
    type: String,
    default: "Date",
  },
  yAxisLabel: {
    type: String,
    default: "Revenue ($)",
  },
  title: {
    type: String,
    default: "Chart",
  },
  dataKey: {
    type: String,
    default: "revenue",
  },
  labelKey: {
    type: String,
    default: "date",
  },
  height: {
    type: Number,
    default: 300,
  },
});

const chartData = computed(() => {
  const labels = props.data.map((item) => item[props.labelKey]);
  const values = props.data.map((item) => item[props.dataKey]);

  if (props.type === "doughnut") {
    return {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: [
            "#3b82f6",
            "#8b5cf6",
            "#ec4899",
            "#f59e0b",
            "#10b981",
            "#06b6d4",
            "#ef4444",
            "#6366f1",
            "#14b8a6",
            "#f97316",
          ],
          borderColor: "#1e293b",
          borderWidth: 2,
        },
      ],
    };
  }

  return {
    labels,
    datasets: [
      {
        label: props.yAxisLabel,
        data: values,
        backgroundColor:
          props.type === "bar"
            ? "rgba(59, 130, 246, 0.7)"
            : "rgba(59, 130, 246, 0.1)",
        borderColor: "rgb(59, 130, 246)",
        borderWidth: 2,
        borderRadius: props.type === "bar" ? 8 : 0,
        fill: props.type === "line" ? true : false,
        pointBackgroundColor: "rgb(59, 130, 246)",
        pointBorderColor: "#fff",
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
        tension: 0.4,
      },
    ],
  };
});

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: props.type !== "doughnut",
      labels: {
        color: "#cbd5e1",
        font: { size: 12 },
        padding: 15,
      },
    },
    tooltip: {
      backgroundColor: "rgba(15, 23, 42, 0.95)",
      titleColor: "#f1f5f9",
      bodyColor: "#e2e8f0",
      borderColor: "#475569",
      borderWidth: 1,
      padding: 12,
      displayColors: true,
      callbacks: {
        label: function (context) {
          if (props.dataKey === "revenue" || props.dataKey === "revenue") {
            return `$${context.parsed.y.toFixed(2)}`;
          }
          return context.parsed.y;
        },
      },
    },
  },
  scales:
    props.type === "doughnut"
      ? {}
      : {
          x: {
            stacked: false,
            grid: {
              display: false,
              drawBorder: false,
            },
            ticks: {
              color: "#94a3b8",
              font: { size: 11 },
            },
          },
          y: {
            beginAtZero: true,
            stacked: false,
            grid: {
              color: "rgba(148, 163, 184, 0.1)",
              drawBorder: false,
            },
            ticks: {
              color: "#94a3b8",
              font: { size: 11 },
              callback(value) {
                if (props.dataKey === "revenue" || props.dataKey === "revenue") {
                  return `$${value}`;
                }
                return value;
              },
            },
          },
        },
}));
</script>

<template>
  <div class="bg-slate-800/50 border border-slate-700/50 rounded-lg p-6 backdrop-blur">
    <h3 class="text-lg font-semibold text-slate-100 mb-4">{{ title }}</h3>
    <div :style="{ height: height + 'px' }">
      <Line v-if="type === 'line'" :data="chartData" :options="chartOptions" />
      <Bar v-else-if="type === 'bar'" :data="chartData" :options="chartOptions" />
      <Doughnut v-else-if="type === 'doughnut'" :data="chartData" :options="chartOptions" />
    </div>
  </div>
</template>
