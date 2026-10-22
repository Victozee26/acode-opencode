import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generatePassword,
  buildAuthTokenUrl,
  buildBasicAuthHeader,
  getInstalledMajor,
  needsPairing,
} from '../../src/opencode/auth';
import * as executorModule from '../../src/terminal/executor';
import { BASE_URL, AUTH_TOKEN_PARAM } from '../../src/config/server';
import { VERSION_CHECK_COMMAND } from '../../src/config/update';

vi.mock('../../src/terminal/executor');

const mockExecute = vi.mocked(executorModule.execute);

beforeEach(() => {
  vi.clearAllMocks();
  mockExecute.mockResolvedValue('2.0.27');
});

function decodeToken(url: string): string {
  const token = url.split(`${AUTH_TOKEN_PARAM}=`)[1];
  const padded = token.replace(/-/g, '+').replace(/_/g, '/');
  return atob(padded);
}

describe('generatePassword', () => {
  it('should_return_48_hex_chars', () => {
    // Act
    const password = generatePassword();

    // Assert
    expect(password).toMatch(/^[0-9a-f]{48}$/);
  });

  it('should_differ_between_calls', () => {
    // Act
    const first = generatePassword();
    const second = generatePassword();

    // Assert
    expect(first).not.toBe(second);
  });
});

describe('buildAuthTokenUrl', () => {
  it('should_encode_known_password_to_verified_vector', () => {
    // Act
    const url = buildAuthTokenUrl('test1234');

    // Assert
    expect(url).toBe(`${BASE_URL}/?${AUTH_TOKEN_PARAM}=b3BlbmNvZGU6dGVzdDEyMzQ`);
  });

  it('should_round_trip_username_and_password', () => {
    // Act
    const url = buildAuthTokenUrl('secret-pw');

    // Assert
    expect(decodeToken(url)).toBe('opencode:secret-pw');
  });

  it('should_emit_url_safe_token_chars_only', () => {
    // Act
    const url = buildAuthTokenUrl(generatePassword());

    // Assert
    const token = url.split(`${AUTH_TOKEN_PARAM}=`)[1];
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe('buildBasicAuthHeader', () => {
  it('should_encode_username_and_password_as_basic_auth', () => {
    // Act
    const header = buildBasicAuthHeader('secret-pw');

    // Assert
    expect(header).toBe(`Basic ${btoa('opencode:secret-pw')}`);
  });

  it('should_use_standard_base64_not_url_safe_alphabet', () => {
    // Act
    const header = buildBasicAuthHeader('p@ss/word+');

    // Assert
    expect(header).toBe(`Basic ${btoa('opencode:p@ss/word+')}`);
    expect(header).not.toContain('-');
    expect(header).not.toContain('_');
  });
});

describe('needsPairing', () => {
  it('should_return_true_when_major_unknown', () => {
    expect(needsPairing(null)).toBe(true);
  });

  it('should_return_false_for_v1', () => {
    expect(needsPairing(1)).toBe(false);
  });

  it('should_return_true_for_v2_and_later', () => {
    expect(needsPairing(2)).toBe(true);
    expect(needsPairing(3)).toBe(true);
  });
});

describe('getInstalledMajor', () => {
  it('should_return_major_for_bare_version', async () => {
    // Arrange
    mockExecute.mockResolvedValue('2.0.27');

    // Act
    const major = await getInstalledMajor();

    // Assert
    expect(major).toBe(2);
    expect(mockExecute).toHaveBeenCalledWith(VERSION_CHECK_COMMAND);
  });

  it('should_return_major_for_decorated_v1_output', async () => {
    // Arrange
    mockExecute.mockResolvedValue('opencode/1.8.0 (linux arm64)');

    // Act
    const major = await getInstalledMajor();

    // Assert
    expect(major).toBe(1);
  });

  it('should_return_null_when_unparseable', async () => {
    // Arrange
    mockExecute.mockResolvedValue('no version here');

    // Act
    const major = await getInstalledMajor();

    // Assert
    expect(major).toBeNull();
  });

  it('should_return_null_when_probe_rejects', async () => {
    // Arrange
    mockExecute.mockRejectedValue(new Error('not found'));

    // Act
    const major = await getInstalledMajor();

    // Assert
    expect(major).toBeNull();
  });
});
