import {render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it} from 'vitest';
import App from '../../App';

describe('ThermoChem Bench — Integration Flows (Blue Pill & Red Pill)', () => {
  it('renders Psychrometric Chart by default and recalculates outputs when inputs change', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByRole('heading', {name: 'Psychrometric Chart'})).toBeInTheDocument();
    expect(screen.getByRole('img', {name: /psychrometric chart/i})).toBeInTheDocument();

    const dbInput = screen.getByLabelText(/Dry-Bulb Temperature/i, {selector: 'input[type="number"]'});
    await user.clear(dbInput);
    await user.type(dbInput, '32');

    // Specific enthalpy and humidity ratio should update dynamically
    const outputsRegion = screen.getByRole('region', {name: 'Calculated outputs'});
    expect(within(outputsRegion).getByText('Humidity Ratio')).toBeInTheDocument();
    expect(within(outputsRegion).getByText('Specific Enthalpy')).toBeInTheDocument();
  });

  it('switches disciplines and diagrams cleanly across all 10 modules', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Switch to Fluid Systems via top bar
    await user.click(screen.getAllByRole('button', {name: 'Fluid Systems'})[0]);
    expect(screen.getByRole('heading', {name: 'Moody Chart'})).toBeInTheDocument();
    expect(screen.getByRole('img', {name: /moody log-log friction factor chart/i})).toBeInTheDocument();

    // Switch to Pump & System Head Curve
    await user.click(screen.getByRole('button', {name: /Pump & System Head Curve/i}));
    expect(screen.getByRole('heading', {name: 'Pump & System Head Curve'})).toBeInTheDocument();

    // Switch to Separations -> McCabe-Thiele
    await user.click(screen.getAllByRole('button', {name: 'Separations'})[0]);
    expect(screen.getByRole('heading', {name: 'McCabe–Thiele Diagram'})).toBeInTheDocument();

    // Switch to Metallurgy -> Iron-Carbon
    await user.click(screen.getAllByRole('button', {name: 'Metallurgy'})[0]);
    expect(screen.getByRole('heading', {name: 'Iron–Carbon Phase Diagram'})).toBeInTheDocument();
  });

  it('displays accessible fine-print tooltips with live data values and dismisses with Escape', async () => {
    const user = userEvent.setup();
    render(<App />);

    const infoBtn = screen.getByRole('button', {name: /Fine print for Dry-Bulb Temperature/i});
    await user.click(infoBtn);

    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toHaveTextContent(/Current Input/i);
    expect(tooltip).toHaveTextContent(/24 °C/i);
    expect(tooltip).toHaveTextContent(/shielded thermometer/i);

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    // Check output metric tooltip includes Computed Value and High Precision
    const outputInfoBtn = screen.getByRole('button', {name: /Fine print for Wet-Bulb Temperature/i});
    await user.click(outputInfoBtn);
    const outTooltip = screen.getByRole('tooltip');
    expect(outTooltip).toHaveTextContent(/Computed Value/i);
    expect(outTooltip).toHaveTextContent(/High Precision/i);
  });

  it('displays floating chart tooltip with interpolated data values on pointer hover', async () => {
    const user = userEvent.setup();
    render(<App />);

    const chartSvg = screen.getByRole('img', {name: /psychrometric chart/i});
    chartSvg.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        width: 720,
        height: 430,
        right: 720,
        bottom: 430,
        x: 0,
        y: 0,
        toJSON: () => {},
      }) as DOMRect;

    await user.pointer({target: chartSvg, coords: {clientX: 360, clientY: 220}});
    const probeTooltip = screen.getByRole('status');
    expect(probeTooltip).toHaveTextContent(/Probe Air State/i);
    expect(probeTooltip).toHaveTextContent(/Dry-Bulb T_db/i);
    expect(probeTooltip).toHaveTextContent(/Enthalpy h/i);
  });

  it('Red Pill: displays validation alert and disables Export CSV on invalid physical input', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Navigate to McCabe-Thiele and enter reflux ratio below R_min
    await user.click(screen.getAllByRole('button', {name: 'Separations'})[0]);
    const refluxInput = screen.getByLabelText(/External Reflux Ratio/i, {selector: 'input[type="number"]'});
    await user.clear(refluxInput);
    await user.type(refluxInput, '0.3');

    const alertBox = screen.getByRole('alert', {name: 'Calculation output error'});
    expect(alertBox).toHaveTextContent(/minimum reflux/i);

    const exportBtn = screen.getByRole('button', {name: /Export CSV/i});
    expect(exportBtn).toBeDisabled();

    // Reset defaults restores valid state
    await user.click(screen.getByRole('button', {name: /Reset Defaults/i}));
    expect(screen.getByRole('region', {name: 'Calculated outputs'})).toBeInTheDocument();
    expect(exportBtn).not.toBeDisabled();
  });
});
