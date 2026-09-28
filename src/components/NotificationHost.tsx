// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import {
  dismissNotification,
  subscribeNotifications,
  type AppNotification,
} from '../services/notificationService';
import './NotificationHost.css';

const ICONS = {
  success: CheckCircle2,
  info: Info,
  warning: AlertTriangle,
  error: XCircle,
} as const;

const NotificationHost: React.FC = () => {
  const [items, setItems] = useState<AppNotification[]>([]);
  useEffect(() => subscribeNotifications(setItems), []);

  const render = (item: AppNotification) => {
    const Icon = ICONS[item.kind];
    return (
      <div key={item.id} className={`app-notification app-notification--${item.kind}`}>
        <Icon size={18} className="app-notification-icon" aria-hidden="true" />
        <p className="app-notification-message">{item.message}</p>
        <button
          type="button"
          className="app-notification-close"
          onClick={() => dismissNotification(item.id)}
          aria-label="Dismiss notification"
          title="Dismiss"
        >
          <X size={14} />
        </button>
      </div>
    );
  };

  // Two live regions so errors interrupt screen readers and the rest do not.
  return (
    <div className="app-notifications">
      <div aria-live="polite" aria-relevant="additions">
        {items.filter((item) => item.kind !== 'error').map(render)}
      </div>
      <div aria-live="assertive" aria-relevant="additions">
        {items.filter((item) => item.kind === 'error').map(render)}
      </div>
    </div>
  );
};

export default NotificationHost;
