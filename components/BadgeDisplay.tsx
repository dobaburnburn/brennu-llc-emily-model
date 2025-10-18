/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
// FIX: Import the Badge type to correctly type the badge object.
import { useBadgeStore, Badge } from '@/lib/state';
import c from 'classnames';

export function BadgeDisplay() {
  const badges = useBadgeStore(state => state.badges);

  return (
    <div className="badge-display">
      {/* FIX: Explicitly type 'badge' to resolve errors from it being inferred as 'unknown'. */}
      {Object.values(badges).map((badge: Badge) => (
        <div
          key={badge.name}
          className={c('badge-item', { unlocked: badge.unlocked })}
          title={badge.unlocked ? badge.description : 'Locked'}
        >
          <div className="badge-icon-wrapper">
            <span className="icon">{badge.icon}</span>
          </div>
          <span className="badge-name">{badge.name}</span>
        </div>
      ))}
    </div>
  );
}
