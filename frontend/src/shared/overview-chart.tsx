import { BarChart, LineChart } from 'echarts/charts';
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import type { ECharts, EChartsCoreOption } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { useEffect, useMemo, useRef } from 'react';

import type { OverviewTrendPoint } from '@/lib/types';

echarts.use([BarChart, LineChart, GridComponent, LegendComponent, TooltipComponent, CanvasRenderer]);

export function OverviewChart({ trend }: { trend: OverviewTrendPoint[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<ECharts | null>(null);
  const data = useMemo(() => trend.map((item) => ({
    month: item.month,
    activeTaskCount: item.active_task_count,
    submittedRecordCount: item.submitted_record_count
  })), [trend]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    chartRef.current?.dispose();
    const chart = echarts.init(container, null, { renderer: 'canvas' });
    chartRef.current = chart;

    const option: EChartsCoreOption = {
      color: ['#60a5fa', '#16a34a'],
      animationDuration: 300,
      grid: {
        top: 36,
        right: 16,
        bottom: 28,
        left: 36,
        containLabel: true
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'cross',
          crossStyle: {
            color: '#94a3b8'
          }
        },
        valueFormatter: (value: unknown) => String(value ?? 0)
      },
      legend: {
        top: 0,
        left: 0,
        itemWidth: 10,
        itemHeight: 10,
        textStyle: {
          color: '#64748b',
          fontSize: 12
        }
      },
      xAxis: {
        type: 'category',
        data: data.map((item) => item.month.slice(5)),
        axisTick: { show: false },
        axisLine: { lineStyle: { color: '#cbd5e1' } },
        axisLabel: { color: '#64748b' }
      },
      yAxis: {
        type: 'value',
        minInterval: 1,
        axisLabel: { color: '#64748b' },
        splitLine: { lineStyle: { color: '#e5e7eb' } }
      },
      series: [
        {
          name: '进行中的实践数',
          type: 'bar',
          barMaxWidth: 30,
          data: data.map((item) => item.activeTaskCount),
          itemStyle: {
            borderRadius: [4, 4, 0, 0]
          }
        },
        {
          name: '提交记录数',
          type: 'line',
          smooth: false,
          symbol: 'circle',
          symbolSize: 7,
          data: data.map((item) => item.submittedRecordCount),
          lineStyle: {
            width: 2
          }
        }
      ]
    };

    chart.setOption(option);

    const observer = new ResizeObserver(() => {
      chart.resize();
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, [data]);

  return <div ref={containerRef} className="h-[320px] w-full overflow-hidden rounded-md" />;
}
