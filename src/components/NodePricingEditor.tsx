// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Per-node cost editor
 *
 * Lets a user change the tier/SKU, the instance count, or override the price
 * outright for a single service. Before this, every estimate used the catalog
 * default tier at quantity 1 with no way to change either, which users pushed
 * back on ("cost as a fixed value is not acceptable, i would rather hide it or
 * make it configurable").
 *
 * `estimatedCost` is stored PER UNIT — calculateCostBreakdown and AzureNode
 * both multiply by quantity themselves.
 */

import { useEffect, useState } from 'react';
import { DollarSign, X } from 'lucide-react';
import type { NodePricingConfig, PricingTier } from '../types/pricing';
import { getAvailableTiers, updateNodePricing, setCustomPricing } from '../services/costEstimationService';
import { formatMonthlyCost } from '../utils/pricingHelpers';
import './NodePricingEditor.css';

interface NodePricingEditorProps {
  /** Service name, used as the pricing lookup key (node.data.label). */
  serviceType: string;
  pricing: NodePricingConfig;
  onApply: (updated: NodePricingConfig) => void;
  onClose: () => void;
}

export default function NodePricingEditor({
  serviceType,
  pricing,
  onApply,
  onClose,
}: NodePricingEditorProps) {
  const [tiers, setTiers] = useState<PricingTier[]>([]);
  const [loadingTiers, setLoadingTiers] = useState(true);
  const [tier, setTier] = useState<string>(pricing.tier);
  const [quantity, setQuantity] = useState<number>(pricing.quantity || 1);
  const [useCustom, setUseCustom] = useState<boolean>(!!pricing.isCustom);
  const [customPrice, setCustomPrice] = useState<string>(
    pricing.customPrice != null ? String(pricing.customPrice) : String(pricing.estimatedCost ?? 0),
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getAvailableTiers(serviceType, pricing.region)
      .then(result => {
        if (!cancelled) {
          setTiers(result);
          setLoadingTiers(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoadingTiers(false);
      });
    return () => {
      cancelled = true;
    };
  }, [serviceType, pricing.region]);

  // Preview mirrors calculateMonthlyCost: unit price x quantity.
  //
  // Usage-based services are the exception. Their catalog "tiers" are
  // consumption meters (per 1K tokens, per hour) that carry a $0 monthly
  // price, while the badge shows a separate consumption fallback estimate.
  // Presenting those as selectable SKUs would let a user apply one and
  // silently zero a real estimate, so the tier picker is suppressed and the
  // existing estimate is kept.
  const tiersSelectable = !pricing.isUsageBased && tiers.length > 0;
  const selectedTier = tiers.find(t => t.skuName === tier || t.name === tier);
  const parsedCustom = Number.parseFloat(customPrice);
  const customIsValid = Number.isFinite(parsedCustom) && parsedCustom >= 0;
  const unitCost = useCustom
    ? (customIsValid ? parsedCustom : 0)
    : tiersSelectable
      ? (selectedTier?.monthlyPrice ?? pricing.estimatedCost ?? 0)
      : (pricing.estimatedCost ?? 0);
  const previewTotal = unitCost * (quantity > 0 ? quantity : 1);

  const canApply = !saving && quantity >= 1 && (!useCustom || customIsValid);

  const handleApply = async () => {
    if (!canApply) return;
    setSaving(true);
    try {
      if (useCustom) {
        // Custom price is per unit, so quantity still scales it.
        onApply({ ...setCustomPricing(pricing, parsedCustom), quantity });
      } else if (!tiersSelectable) {
        // Keep the consumption estimate as-is; only the unit count changed.
        onApply({ ...pricing, quantity, lastUpdated: new Date().toISOString() });
      } else {
        const updated = await updateNodePricing(serviceType, pricing, tier, quantity, pricing.region);
        onApply(updated);
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="npe-modal-overlay" onClick={onClose}>
      <div className="npe-modal" onClick={e => e.stopPropagation()} role="dialog" aria-label="Cost settings">
        <div className="npe-modal-header">
          <div className="npe-modal-title">
            <DollarSign size={20} />
            <span>Cost settings — {serviceType}</span>
          </div>
          <button className="npe-modal-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="npe-modal-body">
          <p className="npe-note">
            Estimates are indicative catalog prices for <strong>{pricing.region}</strong>. Adjust the
            SKU and instance count to match your design, or override the figure with your own
            negotiated price.
          </p>

          <label className="npe-field">
            <span className="npe-label">Tier / SKU</span>
            {loadingTiers ? (
              <span className="npe-hint">Loading available tiers…</span>
            ) : tiersSelectable ? (
              <select
                className="npe-input"
                value={tier}
                disabled={useCustom}
                onChange={e => setTier(e.target.value)}
              >
                {tiers.map(t => (
                  <option key={t.skuName || t.name} value={t.skuName || t.name}>
                    {t.name} — {formatMonthlyCost(t.monthlyPrice)} {t.unit ? `(${t.unit})` : ''}
                  </option>
                ))}
              </select>
            ) : pricing.isUsageBased ? (
              <span className="npe-hint">
                {serviceType} bills on consumption, so there is no monthly SKU to pick. The figure
                shown is an estimate of typical usage — override it below if you have a better one.
              </span>
            ) : (
              <span className="npe-hint">
                No catalog tiers for this service — use a custom price below.
              </span>
            )}
          </label>

          <label className="npe-field">
            <span className="npe-label">Instances / units</span>
            <input
              className="npe-input"
              type="number"
              min={1}
              step={1}
              value={quantity}
              onChange={e => setQuantity(Math.max(1, Number.parseInt(e.target.value, 10) || 1))}
            />
          </label>

          <label className="npe-checkbox">
            <input
              type="checkbox"
              checked={useCustom}
              onChange={e => setUseCustom(e.target.checked)}
            />
            <span>Override with a custom monthly price (per unit)</span>
          </label>

          {useCustom && (
            <label className="npe-field">
              <span className="npe-label">Custom price (USD / month / unit)</span>
              <input
                className={`npe-input${customIsValid ? '' : ' npe-input--invalid'}`}
                type="number"
                min={0}
                step="0.01"
                value={customPrice}
                onChange={e => setCustomPrice(e.target.value)}
              />
              {!customIsValid && <span className="npe-error">Enter a number of 0 or more.</span>}
            </label>
          )}

          <div className="npe-preview">
            <span className="npe-preview-label">Estimated monthly cost</span>
            <span className="npe-preview-value">{formatMonthlyCost(previewTotal)}</span>
            {quantity > 1 && (
              <span className="npe-preview-detail">
                {formatMonthlyCost(unitCost)} × {quantity}
              </span>
            )}
          </div>
        </div>

        <div className="npe-modal-footer">
          <button className="npe-btn npe-btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="npe-btn npe-btn--primary" onClick={handleApply} disabled={!canApply}>
            {saving ? 'Applying…' : 'Apply'}
          </button>
        </div>
      </div>
    </div>
  );
}
