interface AgentData {
  id: string;
  name: string;
  health: number;
  lastExtension: string;
  totalBurned: number;
}

function extractAgentData() {
  const rows = document.querySelectorAll('table tbody tr');
  const agents: AgentData[] = [];
  
  rows.forEach(row => {
    if (!row.querySelector('td')) return; // Skip if not a data row
    
    const cells = row.querySelectorAll('td');
    const agent: AgentData = {
      id: cells[0].textContent || '',
      name: cells[1].textContent || '',
      health: parseFloat(cells[2].textContent || '0'),
      lastExtension: cells[3].textContent || '',
      totalBurned: parseFloat(cells[4].textContent?.replace(/[^0-9.]/g, '') || '0')
    };
    
    agents.push(agent);
  });
  
  return agents;
}

// Copy to clipboard
function copyToClipboard(text: string) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}

// Run the extraction
const agents = extractAgentData();
console.log('Extracted data:', agents);
copyToClipboard(JSON.stringify(agents, null, 2)); 