import { describe, it, expect } from 'vitest';
import { parseRemoteHost, buildRemoteIframeUrl } from '../../src/opencode/remote';
import {
  REMOTE_DEFAULT_HTTP_PORT,
  REMOTE_DEFAULT_HTTPS_PORT,
  REMOTE_SCHEME_SEPARATOR,
} from '../../src/config/remote';
import { AUTH_TOKEN_PARAM } from '../../src/config/server';

describe('parseRemoteHost', () => {
  it('should_return_null_when_value_is_empty', () => {
    // Act
    const host = parseRemoteHost('');

    // Assert
    expect(host).toBeNull();
  });

  it('should_return_null_when_value_is_null', () => {
    // Act
    const host = parseRemoteHost(null);

    // Assert
    expect(host).toBeNull();
  });

  it('should_default_to_http_port_when_host_has_no_port', () => {
    // Act
    const host = parseRemoteHost('opencode.example.com');

    // Assert
    expect(host?.baseUrl).toBe(`http${REMOTE_SCHEME_SEPARATOR}opencode.example.com:${REMOTE_DEFAULT_HTTP_PORT}`);
    expect(host?.port).toBe(REMOTE_DEFAULT_HTTP_PORT);
    expect(host?.secure).toBe(false);
  });

  it('should_use_explicit_port_when_host_carries_one', () => {
    // Act
    const host = parseRemoteHost('192.168.1.10:4123');

    // Assert
    expect(host?.baseUrl).toBe('http://192.168.1.10:4123');
    expect(host?.host).toBe('192.168.1.10');
    expect(host?.port).toBe(4123);
  });

  it('should_keep_scheme_when_value_has_one', () => {
    // Act
    const host = parseRemoteHost('https://opencode.example.com');

    // Assert
    expect(host?.baseUrl).toBe(`https${REMOTE_SCHEME_SEPARATOR}opencode.example.com:${REMOTE_DEFAULT_HTTPS_PORT}`);
    expect(host?.secure).toBe(true);
  });

  it('should_keep_scheme_and_port_when_value_has_both', () => {
    // Act
    const host = parseRemoteHost('https://opencode.example.com:8443');

    // Assert
    expect(host?.baseUrl).toBe('https://opencode.example.com:8443');
    expect(host?.port).toBe(8443);
  });

  it('should_trim_whitespace_when_value_is_padded', () => {
    // Act
    const host = parseRemoteHost('  192.168.1.10:4096  ');

    // Assert
    expect(host?.baseUrl).toBe('http://192.168.1.10:4096');
  });

  it('should_accept_bracketed_ipv6_literal', () => {
    // Act
    const host = parseRemoteHost('[::1]:4096');

    // Assert
    expect(host?.baseUrl).toBe('http://[::1]:4096');
    expect(host?.host).toBe('[::1]');
  });

  it('should_return_null_when_scheme_is_unsupported', () => {
    // Act
    const host = parseRemoteHost('ftp://opencode.example.com');

    // Assert
    expect(host).toBeNull();
  });

  it('should_return_null_when_port_is_not_numeric', () => {
    // Act
    const host = parseRemoteHost('192.168.1.10:port');

    // Assert
    expect(host).toBeNull();
  });

  it('should_return_null_when_port_is_out_of_range', () => {
    // Act
    const host = parseRemoteHost('192.168.1.10:70000');

    // Assert
    expect(host).toBeNull();
  });

  it('should_return_null_when_host_has_invalid_characters', () => {
    // Act
    const host = parseRemoteHost('open code.example.com');

    // Assert
    expect(host).toBeNull();
  });

  it('should_return_null_when_scheme_is_missing_host', () => {
    // Act
    const host = parseRemoteHost('http://');

    // Assert
    expect(host).toBeNull();
  });
});

describe('buildRemoteIframeUrl', () => {
  it('should_return_base_url_when_password_is_null', () => {
    // Act
    const url = buildRemoteIframeUrl('http://192.168.1.10:4096', null);

    // Assert
    expect(url).toBe('http://192.168.1.10:4096');
  });

  it('should_return_sign_in_url_when_password_is_known', () => {
    // Act
    const url = buildRemoteIframeUrl('http://192.168.1.10:4096', 'secret');

    // Assert
    expect(url).toBe(
      `http://192.168.1.10:4096/?${AUTH_TOKEN_PARAM}=${btoa('opencode:secret').replace(/=+$/, '')}`,
    );
  });
});
