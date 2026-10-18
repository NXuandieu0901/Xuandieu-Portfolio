/**
 * MAIN JAVASCRIPT - PORTFOLIO NGUYỄN XUÂN DIỆU
 * Tính năng chính:
 * 1. Hiệu ứng đếm số tăng dần (Counter Animation) với Easing Function mượt mà
 * 2. Tính năng Sao chép nhanh (Copy to Clipboard) kèm Toast thông báo
 * 3. Thanh tiến trình cuộn trang (Scroll Progress Bar)
 * 4. Tự động đánh dấu mục điều hướng đang xem (Active Nav Spy)
 * 5. Menu điều hướng trên thiết bị di động (Mobile Menu Toggle)
 * 6. Tương tác Radar GPS (Hiển thị toạ độ & trạng thái chấm công thời gian thực)
 */

document.addEventListener('DOMContentLoaded', () => {
  // --- 1. THANH TIẾN TRÌNH CUỘN TRANG (SCROLL PROGRESS BAR) ---
  const progressBar = document.getElementById('scrollProgressBar');
  const navbar = document.getElementById('navbar');

  window.addEventListener('scroll', () => {
    const winScroll = document.documentElement.scrollTop || document.body.scrollTop;
    const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    const scrolled = (winScroll / height) * 100;

    if (progressBar) {
      progressBar.style.width = scrolled + '%';
    }

    // Thêm hiệu ứng shadow cho navbar khi cuộn xuống
    if (navbar) {
      if (winScroll > 30) {
        navbar.classList.add('scrolled');
      } else {
        navbar.classList.remove('scrolled');
      }
    }
  }, { passive: true });

  // --- 2. HIỆU ỨNG ĐẾM SỐ TĂNG DẦN (COUNTER ANIMATION) ---
  const counterElements = document.querySelectorAll('.stat-number[data-target]');

  function animateCounter(el) {
    const target = parseInt(el.getAttribute('data-target'), 10);
    if (isNaN(target)) return;

    const duration = 1800; // 1.8 giây
    const frameRate = 60;
    const totalFrames = Math.round((duration / 1000) * frameRate);
    let frame = 0;

    // Easing cubic-bezier out: t * (2 - t) hoặc quartic out
    const easeOutQuart = (t) => 1 - Math.pow(1 - t, 4);

    const timer = setInterval(() => {
      frame++;
      const progress = easeOutQuart(frame / totalFrames);
      const currentVal = Math.round(target * progress);

      el.textContent = currentVal.toLocaleString('vi-VN');

      if (frame >= totalFrames) {
        clearInterval(timer);
        el.textContent = target.toLocaleString('vi-VN');
      }
    }, 1000 / frameRate);
  }

  // Kích hoạt khi cuộn đến vùng nhìn thấy bằng IntersectionObserver
  if ('IntersectionObserver' in window) {
    const counterObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          animateCounter(entry.target);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.35 });

    counterElements.forEach(el => counterObserver.observe(el));
  } else {
    // Fallback nếu trình duyệt không hỗ trợ observer
    counterElements.forEach(el => animateCounter(el));
  }

  // --- 3. TÍNH NĂNG SAO CHÉP (COPY TO CLIPBOARD) & TOAST THÔNG BÁO ---
  const copyButtons = document.querySelectorAll('.btn-copy');
  const toast = document.getElementById('toastNotification');
  const toastMessage = document.getElementById('toastMessage');
  let toastTimeout = null;

  function showToast(message) {
    if (!toast) return;
    if (toastMessage) toastMessage.textContent = message;

    toast.classList.add('show');

    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      toast.classList.remove('show');
    }, 3200);
  }

  copyButtons.forEach(btn => {
    btn.addEventListener('click', async () => {
      const targetId = btn.getAttribute('data-copy-target');
      const targetEl = document.getElementById(targetId);

      if (!targetEl) return;

      const textToCopy = targetEl.textContent.trim();
      const originalText = btn.querySelector('.copy-text')?.textContent || 'Sao chép';
      const labelText = targetEl.id === 'valEmail' ? 'Email' : 
                        targetEl.id === 'valPhone' ? 'Số điện thoại' : 'Liên kết';

      let success = false;

      // Thử dùng navigator.clipboard trước
      if (navigator.clipboard && window.isSecureContext) {
        try {
          await navigator.clipboard.writeText(textToCopy);
          success = true;
        } catch (err) {
          console.warn('Clipboard writeText failed, trying fallback...', err);
        }
      }

      // Fallback bằng textarea nếu clipboard API không thành công
      if (!success) {
        try {
          const textArea = document.createElement('textarea');
          textArea.value = textToCopy;
          textArea.style.position = 'fixed';
          textArea.style.left = '-999999px';
          textArea.style.top = '-999999px';
          document.body.appendChild(textArea);
          textArea.focus();
          textArea.select();
          success = document.execCommand('copy');
          document.body.removeChild(textArea);
        } catch (err) {
          console.error('Copy fallback error:', err);
        }
      }

      // Xử lý giao diện phản hồi
      if (success) {
        btn.classList.add('copied');
        const textSpan = btn.querySelector('.copy-text');
        if (textSpan) textSpan.textContent = 'Đã chép!';

        showToast(`Đã sao chép ${labelText}: ${textToCopy}`);

        setTimeout(() => {
          btn.classList.remove('copied');
          if (textSpan) textSpan.textContent = originalText;
        }, 2200);
      } else {
        showToast(`Không thể sao chép tự động. Vui lòng copy thủ công: ${textToCopy}`);
      }
    });
  });

  // --- 4. ĐIỀU HƯỚNG CUỘN TRANG MƯỢT MÀ & AN TOÀN (SMOOTH SCROLL HANDLER) ---
  const allAnchorLinks = document.querySelectorAll('a[href^="#"]');
  allAnchorLinks.forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      const targetHref = anchor.getAttribute('href');
      if (!targetHref || targetHref === '#') return;

      const targetEl = document.querySelector(targetHref);
      if (targetEl) {
        e.preventDefault();
        if (targetHref === '#tong-quan') {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
          targetEl.scrollIntoView({ behavior: 'smooth' });
        }
        try {
          history.pushState(null, '', targetHref);
        } catch (_) {}
      }
    });
  });

  // --- 5. TỰ ĐỘNG ĐÁNH DẤU MỤC ĐIỀU HƯỚNG KHI CUỘN (NAV SPY) ---
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav-link[href^="#"]');

  window.addEventListener('scroll', () => {
    let current = '';
    const scrollPos = window.scrollY + 160;

    if (window.scrollY < 200) {
      current = 'tong-quan';
    } else {
      sections.forEach(section => {
        const sectionTop = section.offsetTop;
        const sectionHeight = section.offsetHeight;
        if (scrollPos >= sectionTop && scrollPos < sectionTop + sectionHeight) {
          current = section.getAttribute('id');
        }
      });
    }

    navLinks.forEach(link => {
      link.classList.remove('active');
      const href = link.getAttribute('href');
      if (href === `#${current}`) {
        link.classList.add('active');
      }
    });
  }, { passive: true });

  // --- 6. MENU ĐIỀU HƯỚNG TRÊN DI ĐỘNG (MOBILE TOGGLE) ---
  const mobileToggle = document.getElementById('mobileToggle');
  const navLinksContainer = document.getElementById('navLinks');

  if (mobileToggle && navLinksContainer) {
    mobileToggle.addEventListener('click', () => {
      navLinksContainer.classList.toggle('mobile-open');
      const isOpen = navLinksContainer.classList.contains('mobile-open');
      mobileToggle.setAttribute('aria-expanded', isOpen);
    });

    // Đóng menu khi nhấp vào bất kỳ liên kết nào
    navLinksContainer.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', () => {
        navLinksContainer.classList.remove('mobile-open');
        mobileToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // --- 7. TƯƠNG TÁC RADAR GPS SVG (INTERACTIVE BEACON) ---
  const staffPoints = document.querySelectorAll('.staff-point');
  const radarCoords = document.querySelector('.radar-coords');

  staffPoints.forEach(point => {
    point.style.cursor = 'pointer';
    point.addEventListener('mouseenter', () => {
      const tag = point.querySelector('.staff-tag')?.textContent || 'Nhân sự';
      const isValid = point.classList.contains('s-valid');
      if (radarCoords) {
        radarCoords.textContent = `${tag} · ${isValid ? 'VỊ TRÍ HỢP LỆ (Trong Geofence)' : 'ĐANG KẾT NỐI MẠNG'}`;
        radarCoords.style.color = isValid ? 'var(--color-neon-green)' : 'var(--color-neon-cyan)';
      }
    });

    point.addEventListener('mouseleave', () => {
      if (radarCoords) {
        radarCoords.textContent = 'LAT: 21.0285° N · LNG: 105.8542° E';
        radarCoords.style.color = 'var(--text-subtle)';
      }
    });

    point.addEventListener('click', () => {
      const tag = point.querySelector('.staff-tag')?.textContent || 'Nhân sự';
      const isValid = point.classList.contains('s-valid');
      showToast(`${tag}: ${isValid ? 'Chấm công thành công tại Trung tâm' : 'Đang gửi toạ độ GPS...'}`);
    });
  });

  // In thông điệp chào mừng kỹ thuật vào Console
  console.log(
    '%c[NXD.DEV]%c Digital Transformation Portfolio - Nguyễn Xuân Diệu\nPTIT Information Technology · Taekwondo Martial Spirit · System Architecture',
    'color: #00E5FF; background: #0052FF; font-weight: bold; padding: 4px 8px; border-radius: 4px;',
    'color: #0052FF; font-weight: bold;'
  );
});
