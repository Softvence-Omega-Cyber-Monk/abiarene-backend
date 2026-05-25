import { NestFactory } from '@nestjs/core';
import { Logger, RequestMethod, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';

const swaggerTagFilterScript = `
(() => {
  const FILTER_ID = 'swagger-tag-filter';
  const WRAPPER_ID = 'swagger-tag-filter-wrapper';
  let observer;
  let lastSignature = '';

  const getTagName = (section) => {
    const tagHeader = section.querySelector('.opblock-tag');
    return tagHeader?.textContent?.trim() ?? '';
  };

  const applyFilter = (selectedTag) => {
    document.querySelectorAll('.swagger-ui .opblock-tag-section').forEach((section) => {
      const tagName = getTagName(section);
      const isVisible = !selectedTag || tagName === selectedTag;
      section.style.display = isVisible ? '' : 'none';
    });
  };

  const getTags = () =>
    Array.from(document.querySelectorAll('.swagger-ui .opblock-tag-section'))
      .map((section) => getTagName(section))
      .filter(Boolean)
      .filter((tag, index, list) => list.indexOf(tag) === index)
      .sort((a, b) => a.localeCompare(b));

  const syncDropdown = () => {
    const topbar = document.querySelector('.swagger-ui .topbar');
    const topbarWrapper = document.querySelector('.swagger-ui .topbar-wrapper');
    if (!topbar || !topbarWrapper) {
      return;
    }

    const tags = getTags();
    const signature = tags.join('|');

    let wrapper = document.getElementById(WRAPPER_ID);
    if (!wrapper) {
      wrapper = document.createElement('div');
      wrapper.id = WRAPPER_ID;
      wrapper.style.display = 'flex';
      wrapper.style.alignItems = 'center';
      wrapper.style.gap = '12px';
      wrapper.style.marginLeft = 'auto';
      wrapper.style.paddingLeft = '16px';
      wrapper.style.position = 'relative';
      wrapper.style.zIndex = '2';
      topbarWrapper.appendChild(wrapper);
    }

    if (!tags.length) {
      wrapper.style.display = 'none';
      return;
    }

    wrapper.style.display = 'flex';

    let label = wrapper.querySelector('label');
    if (!label) {
      label = document.createElement('label');
      label.htmlFor = FILTER_ID;
      label.textContent = 'Category';
      label.style.color = '#ffffff';
      label.style.fontSize = '13px';
      label.style.fontWeight = '600';
      label.style.whiteSpace = 'nowrap';
      wrapper.appendChild(label);
    }

    let select = document.getElementById(FILTER_ID);
    if (!select) {
      select = document.createElement('select');
      select.id = FILTER_ID;
      select.style.minWidth = '180px';
      select.style.height = '36px';
      select.style.padding = '0 12px';
      select.style.border = '1px solid rgba(255, 255, 255, 0.35)';
      select.style.borderRadius = '6px';
      select.style.background = '#fff';
      select.style.color = '#111827';
      select.style.fontSize = '13px';
      select.addEventListener('change', (event) => {
        applyFilter(event.target.value);
      });
      wrapper.appendChild(select);
    }

    const currentValue = select.value;
    if (signature === lastSignature && select.options.length === tags.length + 1) {
      applyFilter(currentValue);
      return;
    }

    select.innerHTML = '';

    const allOption = document.createElement('option');
    allOption.value = '';
    allOption.textContent = 'All Categories';
    select.appendChild(allOption);

    tags.forEach((tag) => {
      const option = document.createElement('option');
      option.value = tag;
      option.textContent = tag;
      select.appendChild(option);
    });

    select.value = tags.includes(currentValue) ? currentValue : '';
    lastSignature = signature;
    applyFilter(select.value);
  };

  const init = () => {
    syncDropdown();
    if (observer) {
      return;
    }
    observer = new MutationObserver((mutations) => {
      const hasRelevantChange = mutations.some((mutation) =>
        Array.from(mutation.addedNodes).some((node) => {
          if (!(node instanceof HTMLElement)) {
            return false;
          }
          if (node.id === WRAPPER_ID || node.closest('#' + WRAPPER_ID)) {
            return false;
          }
          return (
            node.matches?.('.opblock-tag-section, .swagger-ui, .topbar, .topbar-wrapper') ||
            node.querySelector?.('.opblock-tag-section, .swagger-ui .topbar, .swagger-ui .topbar-wrapper')
          );
        }),
      );

      if (hasRelevantChange) {
        syncDropdown();
      }
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  };

  if (document.readyState === 'loading') {
    window.addEventListener('load', init);
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
`;

const swaggerStickyHeaderCss = `
  html {
    scroll-padding-top: 132px;
  }

  .swagger-ui .topbar {
    position: sticky;
    top: 0;
    z-index: 1001;
    box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);
  }

  .swagger-ui .scheme-container {
    position: sticky;
    top: 44px;
    z-index: 1000;
    background: #ffffff;
    box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);
  }

  .swagger-ui .information-container,
  .swagger-ui .scheme-container,
  .swagger-ui .opblock-tag,
  .swagger-ui .opblock {
    scroll-margin-top: 140px;
  }
`;

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = parseInt(process.env.PORT ?? '3000', 10);
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
        .map((origin) => origin.trim())
        .filter(Boolean)
    : [
        'http://localhost:5173',
        'http://localhost:5174',
        'http://localhost:3000',
        'http://localhost:3001',
        'https://abiarene-frontend.vercel.app',
      ];

  app.setGlobalPrefix('api', {
    exclude: [{ path: '/', method: RequestMethod.GET }],
  });
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Restaurant POS SaaS API')
    .setDescription(
      'Multi-tenant restaurant POS backend APIs with role-based access',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      deepLinking: true,
      persistAuthorization: true,
    },
    customCss: swaggerStickyHeaderCss,
    customJsStr: swaggerTagFilterScript,
  });

  await app.listen(port, '0.0.0.0');
  Logger.log(`Server running on port ${port}`, 'Bootstrap');
}
void bootstrap();
