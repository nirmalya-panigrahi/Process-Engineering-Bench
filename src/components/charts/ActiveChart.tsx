import type {
  IronCarbonResult,
  McCabeThieleResult,
  MollierResult,
  MoodyResult,
  PhResult,
  PowerCycleResult,
  PsychroResult,
  PumpHeadResult,
  TernaryResult,
  TttResult,
} from '../../engines';
import type {ModuleId} from '../../types/bench';
import {IronCarbonChart} from './IronCarbonChart';
import {McCabeThieleChart} from './McCabeThieleChart';
import {MollierChart} from './MollierChart';
import {MoodyChart} from './MoodyChart';
import {PhRefrigerationChart} from './PhRefrigerationChart';
import {PsychrometricChart} from './PsychrometricChart';
import {PumpHeadChart} from './PumpHeadChart';
import {TernaryPhaseChart} from './TernaryPhaseChart';
import {TsPvCycleChart} from './TsPvCycleChart';
import {TttDiagramChart} from './TttDiagramChart';

interface ActiveChartProps {
  moduleId: ModuleId;
  evaluation: unknown;
  finePrint: string;
}

export function ActiveChart({moduleId, evaluation, finePrint}: ActiveChartProps) {
  switch (moduleId) {
    case 'psychrometric':
      return <PsychrometricChart result={evaluation as PsychroResult} finePrint={finePrint} />;
    case 'moody':
      return <MoodyChart result={evaluation as MoodyResult} finePrint={finePrint} />;
    case 'mollier':
      return <MollierChart result={evaluation as MollierResult} finePrint={finePrint} />;
    case 'ph-refrigeration':
      return <PhRefrigerationChart result={evaluation as PhResult} finePrint={finePrint} />;
    case 'ts-pv-cycles':
      return <TsPvCycleChart result={evaluation as PowerCycleResult} finePrint={finePrint} />;
    case 'mccabe-thiele':
      return <McCabeThieleChart result={evaluation as McCabeThieleResult} finePrint={finePrint} />;
    case 'ternary-phase':
      return <TernaryPhaseChart result={evaluation as TernaryResult} finePrint={finePrint} />;
    case 'iron-carbon':
      return <IronCarbonChart result={evaluation as IronCarbonResult} finePrint={finePrint} />;
    case 'ttt-diagram':
      return <TttDiagramChart result={evaluation as TttResult} finePrint={finePrint} />;
    case 'pump-head':
      return <PumpHeadChart result={evaluation as PumpHeadResult} finePrint={finePrint} />;
  }
}
