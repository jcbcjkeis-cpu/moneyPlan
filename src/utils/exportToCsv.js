export function exportExpensesToCsv(expenses, yearMonth) {
  if (!expenses || expenses.length === 0) {
    alert('해당 월에 내보낼 지출 데이터가 없습니다.');
    return;
  }

  const headers = ['일자', '결제자', '결제수단', '카테고리', '사용처/내역', '결제금액(원)', '공동생활비여부', '정산완료여부', '메모'];

  const rows = expenses.map((item) => {
    const payerKr = item.payer === 'husband' ? '남편' : '아내';
    const isJointKr = item.is_joint_expense ? '공동' : '개인';
    const isSettledKr = item.is_settled ? '완료' : '미완료';
    
    const safeContent = `"${(item.content || '').replace(/"/g, '""')}"`;
    const safeMemo = `"${(item.memo || '').replace(/"/g, '""')}"`;

    return [
      item.expense_date,
      payerKr,
      `"${item.card_name || '일반결제'}"`,
      `"${item.category}"`,
      safeContent,
      item.amount,
      isJointKr,
      isSettledKr,
      safeMemo,
    ].join(',');
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  
  link.setAttribute('href', url);
  link.setAttribute('download', `부부로그_가계부내역_${yearMonth}.csv`);
  document.body.appendChild(link);
  
  link.click();
  
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}