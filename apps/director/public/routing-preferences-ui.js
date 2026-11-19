const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function routingPreferencesHTML(preferences,operation){
 const current=preferences?.current,goal=current?.intent?.qualityGoals?.[0]?.goal||'',options=[...new Set([...(preferences?.goalOptions||[]),...(goal?[goal]:[])])];
 return `<details id="routing-preferences"><summary>Model selection preferences</summary><p class="small muted">Optional. Applies to this planning operation. Existing references, media and history stay saved. Changing preferences requires a new spending allowance.</p><form id="routing-preferences-form"><label>Prioritize measured quality<select name="goal"><option value="">Keep reviewed registry defaults</option>${options.map(x=>`<option value="${esc(x)}" ${x===goal?'selected':''}>${esc(x)}</option>`).join('')}</select></label><p class="small muted">Only recorded evaluation categories are offered. Missing or stale evidence holds the route. These preferences grant no spending permission.</p><input type="hidden" name="operation" value="${esc(operation)}"><button type="submit">Save and approve preferences</button></form></details>`;
}

export function updateRoutingGoal(current,goal,operation){
 const intent=structuredClone(current?.intent||{}),operations=[...new Set([...(current?.operations||[]),operation])];
 if(current?.intent?.optimization||current?.intent?.qualityGoals?.length>1)throw Error('This policy has detailed optimization or multiple goals. Review its complete saved record before replacing it.');
 const previous=intent.qualityGoals?.[0];if(previous?.minimumScore!==undefined&&goal!==previous.goal)throw Error('This policy has a hard quality floor. Review its complete saved record before changing the category.');if(goal)intent.qualityGoals=[{...(previous?.goal===goal?previous:{}),goal,weight:previous?.weight??1}];else delete intent.qualityGoals;
 return {intent,operations};
}
